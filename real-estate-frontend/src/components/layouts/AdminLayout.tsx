import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Button, theme } from 'antd';
import {
    HomeOutlined,
    BankOutlined,
    EnvironmentOutlined,
    FileTextOutlined,
    CalendarOutlined,
    UserOutlined,
    TeamOutlined,
    StarOutlined,
    AppstoreOutlined,
    SafetyOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    LogoutOutlined,
    SettingOutlined,
    WalletOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuthStore } from '@/stores/authStore';

const { Header, Sider, Content } = Layout;

const menuItems: MenuProps['items'] = [
    {
        key: '/admin',
        icon: <HomeOutlined />,
        label: 'Dashboard',
    },
    {
        key: '/admin/houses',
        icon: <BankOutlined />,
        label: 'Nhà',
    },
    {
        key: '/admin/lands',
        icon: <EnvironmentOutlined />,
        label: 'Đất',
    },
    {
        key: '/admin/posts',
        icon: <FileTextOutlined />,
        label: 'Bài đăng',
    },
    {
        key: '/admin/appointments',
        icon: <CalendarOutlined />,
        label: 'Lịch hẹn',
    },
    {
        key: '/admin/categories',
        icon: <AppstoreOutlined />,
        label: 'Danh mục BĐS',
    },
    {
        key: 'users-group',
        icon: <TeamOutlined />,
        label: 'Quản lý người dùng',
        children: [
            {
                key: '/admin/users',
                icon: <UserOutlined />,
                label: 'Người dùng',
            },
            {
                key: '/admin/customers',
                icon: <TeamOutlined />,
                label: 'Khách hàng',
            },
            {
                key: '/admin/employees',
                icon: <TeamOutlined />,
                label: 'Nhân viên',
            },
        ],
    },
    {
        key: '/admin/roles',
        icon: <SafetyOutlined />,
        label: 'Vai trò',
    },
    {
        key: '/admin/payment-history',
        icon: <WalletOutlined />,
        label: 'Lịch sử thanh toán',
    },
];

const AdminLayout: React.FC = () => {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthStore();
    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();

    const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
        navigate(key);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const userMenuItems: MenuProps['items'] = [
        {
            key: 'profile',
            icon: <UserOutlined />,
            label: 'Hồ sơ cá nhân',
            onClick: () => navigate('/admin/profile'),
        },
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: 'Cài đặt',
        },
        { type: 'divider' },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Đăng xuất',
            onClick: handleLogout,
        },
    ];

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider
                trigger={null}
                collapsible
                collapsed={collapsed}
                width={260}
                style={{
                    overflow: 'auto',
                    height: '100vh',
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    bottom: 0,
                }}
            >
                <div
                    style={{
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: collapsed ? 16 : 20,
                        fontWeight: 'bold',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                    }}
                >
                    {collapsed ? 'RE' : '🏠 Real Estate'}
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    defaultOpenKeys={['users-group']}
                    items={menuItems}
                    onClick={handleMenuClick}
                />
            </Sider>

            <Layout style={{ marginLeft: collapsed ? 80 : 260, transition: 'all 0.2s' }}>
                <Header
                    style={{
                        padding: '0 24px',
                        background: colorBgContainer,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                    }}
                >
                    <Button
                        type="text"
                        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        onClick={() => setCollapsed(!collapsed)}
                        style={{ fontSize: 16 }}
                    />

                    <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar icon={<UserOutlined />} />
                            <span>{user?.fullName || user?.username || 'Admin'}</span>
                        </div>
                    </Dropdown>
                </Header>

                <Content
                    style={{
                        margin: 24,
                        padding: 24,
                        background: colorBgContainer,
                        borderRadius: borderRadiusLG,
                        minHeight: 280,
                    }}
                >
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    );
};

export default AdminLayout;
