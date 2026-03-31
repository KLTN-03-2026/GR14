import { useEffect, useState } from 'react';
import { houseApi, landApi, appointmentApi } from '@/api';
import { userApi, postApi } from '@/api';

const DashboardPage: React.FC = () => {
    const [stats, setStats] = useState({
        houses: 0,
        lands: 0,
        users: 0,
        appointments: 0,
        posts: 0,
    });

    async function loadStats() {
        try {
            const [housesRes, landsRes, usersRes, appointmentsRes, postsRes] = await Promise.allSettled([
                houseApi.getAll({ limit: 1 }),
                landApi.getAll({ limit: 1 }),
                userApi.getAll({ limit: 1 }),
                appointmentApi.getAll(),
                postApi.getAll(),
            ]);

            setStats({
                houses: housesRes.status === 'fulfilled' ? (housesRes.value.data.meta?.total || 0) : 0,
                lands: landsRes.status === 'fulfilled' ? (landsRes.value.data.meta?.total || 0) : 0,
                users: usersRes.status === 'fulfilled' ? (usersRes.value.data.meta?.total || 0) : 0,
                appointments: appointmentsRes.status === 'fulfilled' ? ((appointmentsRes.value.data.data || appointmentsRes.value.data)?.length || 0) : 0,
                posts: postsRes.status === 'fulfilled' ? ((postsRes.value.data.data || postsRes.value.data)?.length || 0) : 0,
            });
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadStats();
    }, []);

    const statCards = [
        {
            title: 'Nhà',
            value: stats.houses,
            color: 'text-brand-500',
            bgColor: 'bg-brand-50',
            icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
        },
        {
            title: 'Đất',
            value: stats.lands,
            color: 'text-success-500',
            bgColor: 'bg-success-50',
            icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
        },
        {
            title: 'Người dùng',
            value: stats.users,
            color: 'text-blue-light-500',
            bgColor: 'bg-blue-light-50',
            icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
        },
        {
            title: 'Lịch hẹn',
            value: stats.appointments,
            color: 'text-warning-500',
            bgColor: 'bg-warning-50',
            icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
        },
        {
            title: 'Bài đăng',
            value: stats.posts,
            color: 'text-error-500',
            bgColor: 'bg-error-50',
            icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
        },
    ];

    return (
        <div className="space-y-5">
            <div className="admin-toolbar">
                <div>
                    <h3 className="admin-page-title text-2xl font-bold text-gray-900">Dashboard</h3>
                    <p className="mt-1 text-sm text-gray-500">Theo dõi nhanh hoạt động toàn hệ thống quản trị.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {statCards.map((card) => (
                    <div
                        key={card.title}
                        className="admin-form-surface rounded-2xl border border-gray-200 p-5"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 mb-1">{card.title}</p>
                                <p className={`text-3xl font-extrabold tracking-tight ${card.color}`}>
                                    {card.value}
                                </p>
                            </div>
                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.bgColor} ${card.color}`}>
                                {card.icon}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DashboardPage;
