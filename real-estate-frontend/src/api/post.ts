import apiClient from './client';
import { PostType } from '../types/post';

export const postApi = {
    getApproved: (params?: { page?: number; limit?: number; postType?: PostType }) =>
        apiClient.get('/posts/approved', { params }),

    getPending: (params?: { postType?: PostType }) =>
        apiClient.get('/posts/pending', { params }),

    getAll: (params?: { postType?: PostType }) =>
        apiClient.get('/posts/all', { params }),

    getMyPosts: (params?: { postType?: PostType }) =>
        apiClient.get('/posts/my-posts', { params }),

    getById: (id: number) =>
        apiClient.get(`/posts/${id}`),

    create: (data: FormData) =>
        apiClient.post('/posts', data, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),

    update: (id: number, data: FormData) =>
        apiClient.put(`/posts/${id}`, data, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),

    approve: (id: number) =>
        apiClient.put(`/posts/${id}/approve`),

    reject: (id: number) =>
        apiClient.put(`/posts/${id}/reject`),

    delete: (id: number) =>
        apiClient.delete(`/posts/${id}`),
};
