import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

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
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const currentRefreshToken = useAuthStore.getState().refreshToken;
                if (!currentRefreshToken) {
                    useAuthStore.getState().logout();
                    return Promise.reject(error);
                }

                const response = await axios.post<{ accessToken: string; refreshToken?: string }>(`${API_BASE_URL}/refresh-token`, {
                    refreshToken: currentRefreshToken,
                });

                const { accessToken, refreshToken: rotatedRefreshToken } = response.data;
                useAuthStore.getState().setTokens(accessToken, rotatedRefreshToken ?? currentRefreshToken);

                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return apiClient(originalRequest);
            } catch {
                useAuthStore.getState().logout();
                return Promise.reject(error);
            }
        }

        return Promise.reject(error);
    },
);

export default apiClient;
