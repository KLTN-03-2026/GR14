import apiClient from './client';

export interface FengshuiAnalyzePayload {
    name: string;
    birthDate: string;      
    calendarType: 'solar' | 'lunar';
    gender: 'male' | 'female';
    location?: string;
}

export const fengshuiApi = {
    analyze: (data: FengshuiAnalyzePayload) =>
        apiClient.post('/fengshui/analyze', data),
};