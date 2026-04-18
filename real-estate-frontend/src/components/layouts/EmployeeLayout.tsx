import { useCallback, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { SidebarProvider, useSidebar } from '@/context/SidebarContext';
import { Dropdown, DropdownItem } from '@/components/ui';

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
);

type EmployeeNavItem = {
    name: string;
    path: string;
    icon: React.ReactNode;
};

const menuItems: EmployeeNavItem[] = [
    {
        name: 'Thống kê',
        path: '/employee/dashboard',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
        ),
    },
    {
        name: 'Nhà',
        path: '/employee/houses',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
            </svg>
        ),
    },
    {
        name: 'Đất',
        path: '/employee/lands',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
        ),
    },
    {
        name: 'Bài đăng',
        path: '/employee/posts',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
        ),
    },
    {
        name: 'Lịch hẹn của tôi',
        path: '/employee/appointments',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
        ),
    },
    {
        name: 'Lịch làm việc',
        path: '/employee/calendar',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 8.25h18M4.5 6.75h15a1.5 1.5 0 011.5 1.5v11.25A1.5 1.5 0 0119.5 21h-15A1.5 1.5 0 013 19.5V8.25a1.5 1.5 0 011.5-1.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 12h3.75M8.25 15.75h7.5M14.25 12h1.5" />
            </svg>
        ),
    },
    {
        name: 'Hồ sơ cá nhân',
        path: '/employee/profile',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
        ),
    },
];

const EmployeeSidebar: React.FC = () => {
    const { isExpanded, isHovered, isMobileOpen, setIsHovered } = useSidebar();
    const navigate = useNavigate();
    const location = useLocation();
    const sidebarExpanded = isExpanded || isHovered || isMobileOpen;

    const isActive = useCallback((path: string) => location.pathname === path, [location.pathname]);

    return (
        <aside
            className={`fixed top-0 left-0 flex flex-col h-screen bg-gray-950 text-white transition-all duration-300 ease-in-out z-50 border-r border-gray-800/80 shadow-theme-md
                ${sidebarExpanded ? 'w-[260px]' : 'w-[80px]'}
                ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
            onMouseEnter={() => !isExpanded && setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className={`flex items-center h-16 px-5 border-b border-gray-800/80 ${!sidebarExpanded ? 'justify-center' : ''}`}>
                <button onClick={() => navigate('/employee')} className="text-white font-bold text-lg tracking-tight">
                    {sidebarExpanded ? 'Nhân viên BĐS' : 'NV'}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 px-3">
                <nav className="flex flex-col gap-1">
                    {menuItems.map((item) => (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`flex items-center w-full gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isActive(item.path)
                                ? 'bg-brand-500 text-white shadow-theme-sm'
                                : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                } ${!sidebarExpanded ? 'justify-center' : ''}`}
                        >
                            <span className="flex-shrink-0">{item.icon}</span>
                            {sidebarExpanded && <span>{item.name}</span>}
                        </button>
                    ))}
                </nav>
            </div>
        </aside>
    );
};

const EmployeeBackdrop: React.FC = () => {
    const { isMobileOpen, toggleMobileSidebar } = useSidebar();
    if (!isMobileOpen) return null;
    return <div className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden" onClick={toggleMobileSidebar} />;
};

const EmployeeHeader: React.FC = () => {
    const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const handleToggle = () => {
        if (window.innerWidth >= 1024) {
            toggleSidebar();
        } else {
            toggleMobileSidebar();
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="sticky top-0 z-[9999] flex items-center justify-between h-16 px-4 lg:px-6 bg-white/80 backdrop-blur-xl border-b border-gray-200 shadow-theme-xs">
            <button
                className="flex items-center justify-center w-10 h-10 text-gray-500 rounded-lg hover:bg-gray-100 lg:border lg:border-gray-200"
                onClick={handleToggle}
                aria-label="Toggle Sidebar"
            >
                {isMobileOpen ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                )}
            </button>

            <div className="relative">
                <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="dropdown-toggle flex items-center gap-2 cursor-pointer text-gray-700 hover:text-gray-900"
                >
                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-brand-100 text-brand-600 font-semibold text-sm">
                        {(user?.fullName || user?.username || 'N').charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden sm:inline text-sm font-semibold">
                        {user?.fullName || user?.username || 'Nhân viên'}
                    </span>
                    <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                </button>

                <Dropdown isOpen={dropdownOpen} onClose={() => setDropdownOpen(false)} className="w-52">
                    <div className="py-1">
                        <DropdownItem onClick={() => { navigate('/employee/profile'); setDropdownOpen(false); }}>
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                </svg>
                                Hồ sơ cá nhân
                            </span>
                        </DropdownItem>
                        <DropdownItem onClick={() => { navigate('/'); setDropdownOpen(false); }}>
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                </svg>
                                Xem trang người dùng
                            </span>
                        </DropdownItem>
                        <div className="border-t border-gray-100 my-1" />
                        <DropdownItem onClick={handleLogout} danger>
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                                </svg>
                                Đăng xuất
                            </span>
                        </DropdownItem>
                    </div>
                </Dropdown>
            </div>
        </header>
    );
};

const EmployeeLayoutContent: React.FC = () => {
    const { isExpanded, isHovered } = useSidebar();

    return (
        <div className="admin-shell min-h-screen">
            <EmployeeSidebar />
            <EmployeeBackdrop />
            <div className={`flex-1 transition-all duration-300 ease-in-out ${isExpanded || isHovered ? 'lg:ml-[260px]' : 'lg:ml-[80px]'}`}>
                <EmployeeHeader />
                <main className="p-4 md:p-6 lg:p-7 max-w-[1600px] mx-auto">
                    <Outlet />
                </main>
                <Toaster position="top-right" />
            </div>
        </div>
    );
};

const EmployeeLayout: React.FC = () => {
    return (
        <SidebarProvider>
            <EmployeeLayoutContent />
        </SidebarProvider>
    );
};

export default EmployeeLayout;
