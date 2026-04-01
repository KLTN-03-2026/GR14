import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

type RetryableRequestConfig = InternalAxiosRequestConfig & {
    _retry?: boolean;
};

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

const refreshClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

let isRefreshing = false;
let requestQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
    requestQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else if (token) {
            resolve(token);
        }
    });
    requestQueue = [];
};

// Request interceptor - attach token
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = useAuthStore.getState().accessToken;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error),
);

// Response interceptor - handle token refresh
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = (error.config || {}) as RetryableRequestConfig;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const currentRefreshToken = useAuthStore.getState().refreshToken;
            if (!currentRefreshToken) {
                useAuthStore.getState().logout();
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    requestQueue.push({
                        resolve: (newAccessToken: string) => {
                            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                            resolve(apiClient(originalRequest));
                        },
                        reject,
                    });
                });
            }

            isRefreshing = true;

            try {
                const response = await refreshClient.post<{ accessToken: string; refreshToken?: string }>(`/refresh-token`, {
                    refreshToken: currentRefreshToken,
                });

                const { accessToken, refreshToken: rotatedRefreshToken } = response.data;
                useAuthStore.getState().setTokens(accessToken, rotatedRefreshToken ?? currentRefreshToken);

                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                processQueue(null, accessToken);
                return apiClient(originalRequest);
            } catch (refreshError: any) {
                const refreshStatus = refreshError?.response?.status;
                // Only force logout when refresh token is truly invalid/expired.
                if (refreshStatus === 401 || refreshStatus === 403) {
                    useAuthStore.getState().logout();
                }
                processQueue(refreshError, null);
                return Promise.reject(error);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    },
);

export default apiClient;
