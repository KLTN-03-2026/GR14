import apiClient from './client';
import type { LoginRequest, RegisterRequest, AuthResponse, ForgotPasswordRequest, ResetPasswordRequest } from '@/types';

export const authApi = {
    login: (data: LoginRequest) =>
        apiClient.post<AuthResponse>('/login', data),
    register: (data: RegisterRequest) =>
        apiClient.post('/register', data),

    confirmRegister: (data: RegisterRequest & { otp: string }) =>
        apiClient.post('/register/confirm', data),

    googleLogin: (idToken: string) =>
        apiClient.post<AuthResponse>('/login-google', { idToken }),

    refreshToken: (refreshToken: string) =>
        apiClient.post<{ data: AuthResponse }>('/refresh-token', { refreshToken }),

    forgotPassword: (data: ForgotPasswordRequest) =>
        apiClient.post('/forgot-password', data),

    resetPassword: (data: ResetPasswordRequest) =>
        apiClient.post('/reset-password', data),

    logout: (refreshToken: string) =>
        apiClient.post('/logout', { refreshToken }),
};
