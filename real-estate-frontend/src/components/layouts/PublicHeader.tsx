import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dropdown, type MenuProps } from 'antd';
import { UserOutlined, FileTextOutlined, HeartOutlined, CalendarOutlined, CrownOutlined, LogoutOutlined, BellOutlined } from '@ant-design/icons';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import group from "../../assets/logo.png";

const navigationItems = [
  { label: "Trang Chủ", href: "/" },
  { label: "Nhà Ở", href: "/houses" },
  { label: "Đất Đai", href: "/lands" },
  { label: "Bài Viết", href: "/posts" },
  { label: "Về Chúng Tôi", href: "/about" },
  { label: "Phong Thủy", href: "/fengshui" },
  { label: "Định giá AI", href: "/valuation" },
];

const PublicHeader: React.FC = () => {
  const navigate = useNavigate();

  const { user, isAuthenticated, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCreatePostClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (isAuthenticated) return;
    event.preventDefault();
    toast('Vui lòng đăng nhập để đăng bài viết');
    navigate('/login');
  };

  const isAdmin = user?.roles?.includes('ADMIN') || false;
  const isEmployee = user?.roles?.includes('EMPLOYEE') || false;

  let vipText = 'Thành viên';
  let isVipActive = false;

  if (user?.isVip && user?.vipExpiry) {
    const expiryDate = new Date(user.vipExpiry);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      isVipActive = true;
      vipText = `VIP - còn ${diffDays} ngày`;
    }
  }

  const userMenu: MenuProps['items'] = [
    {
      key: 'header',
      label: (
        <div className="flex items-center gap-3 py-1 cursor-default">
          <div className="w-11 h-11 bg-[#254b86] text-white rounded-full flex items-center justify-center font-bold text-lg shrink-0">
            {user?.fullName?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[#111827] text-[15px] leading-tight">
              {user?.fullName || user?.username}
            </span>
            {isVipActive ? (
              <span className="text-[#d97706] text-[12px] font-semibold flex items-center gap-1 mt-0.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 19h20v2H2v-2zm2-7l5 5 5-8 5 5 3-5v9H2v-9l2 3z" />
                </svg>
                {vipText}
              </span>
            ) : (
              <span className="text-gray-500 text-[12px] font-medium flex items-center gap-1 mt-0.5">
                {vipText}
              </span>
            )}
          </div>
        </div>
      ),
      style: { paddingBottom: '8px' }
    },
    { type: 'divider' },
    ...(isAdmin ? [
      { key: 'admin-panel', label: <Link to="/admin" className="flex items-center gap-3 text-[14px] text-gray-700 py-1.5"><UserOutlined className="text-[16px]" /> Về quản trị</Link> },
      { type: 'divider' as const },
    ] : []),
    ...(isEmployee ? [
      { key: 'employee-panel', label: <Link to="/employee" className="flex items-center gap-3 text-[14px] text-gray-700 py-1.5"><UserOutlined className="text-[16px]" /> Về quản trị nhân viên</Link> },
      { type: 'divider' as const },
    ] : []),
    { key: 'profile', label: <Link to="/profile" className="flex items-center gap-3 text-[14px] text-gray-700 py-1.5"><UserOutlined className="text-[16px]" /> Hồ sơ cá nhân</Link> },
    { key: 'my-posts', label: <Link to="/my-posts" className="flex items-center gap-3 text-[14px] text-gray-700 py-1.5"><FileTextOutlined className="text-[16px]" /> Bài đăng của tôi</Link> },
    { key: 'favorites', label: <Link to="/favorites" className="flex items-center gap-3 text-[14px] text-gray-700 py-1.5"><HeartOutlined className="text-[16px]" /> Đã yêu thích</Link> },
    { key: 'appointments', label: <Link to="/appointments" className="flex items-center gap-3 text-[14px] text-gray-700 py-1.5"><CalendarOutlined className="text-[16px]" /> Lịch hẹn</Link> },
    { key: 'upgrade-vip', label: <Link to="/vip-upgrade" className="flex items-center gap-3 text-[14px] font-semibold text-[#d97706] py-1.5"><CrownOutlined className="text-[16px]" /> Nâng cấp VIP</Link> },
    { type: 'divider' },
    { key: 'logout', danger: true, label: <span onClick={handleLogout} className="flex items-center gap-3 text-[14px] py-1.5"><LogoutOutlined className="text-[16px]" /> Đăng xuất</span> },
  ];

  return (
    <header className="flex h-20 items-center justify-center gap-2.5 p-2.5 w-full bg-[#f5f5f54c] sticky top-0 z-[100] shadow-sm backdrop-blur-md">
      <nav className="grid grid-cols-[1fr_auto_1fr] w-full max-w-[1290px] items-center gap-x-12" aria-label="Main navigation">

        {/* PHẦN TRÁI: Logo */}
        <div className="flex justify-end items-center pr-4">
          <Link to="/" className="flex items-center gap-3 self-center h-full" aria-label="Black'S City Home">
            <img className="w-[45px] h-8" alt="Black'S City Logo" src={group} />
            <div className="font-black text-variable-collection-primary-800 text-[22px] leading-7 whitespace-nowrap">
              Black'S City
            </div>
          </Link>
        </div>

        {/* PHẦN GIỮA: Navigation */}
        <ul className="hidden lg:flex justify-center items-center gap-5">
          {navigationItems.map((item, index) => (
            <li key={index}>
              <Link
                to={item.href}
                onClick={item.href === '/posts/new' ? handleCreatePostClick : undefined}
                className="flex items-center gap-0.5 whitespace-nowrap font-a font-[number:var(--a-font-weight)] text-variable-collection-general-900 text-[length:var(--a-font-size)] hover:text-[#254b86] transition-colors"
              >
                {item.label}
                {item.label === 'Định giá AI' && (
                  <span className="flex items-center gap-[2px] px-1.5 py-[1.5px] rounded border border-teal-100 bg-[#e6f4f1] text-[#00a884] text-[9px] font-extrabold transform -translate-y-2">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M3 12h18M6.5 6.5l11 11M6.5 17.5l11-11" /></svg>
                    AI
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>

        {/* PHẦN PHẢI: Buttons & User Menu */}
        <div className="flex justify-end items-center gap-4">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-5">
              {/* Heart icon */}
              <Link to="/favorites" className="text-gray-500 hover:text-red-500 transition-colors flex items-center">
                <HeartOutlined className="text-[22px] stroke-current" style={{ strokeWidth: 20 }} />
              </Link>

              {/* Bell icon */}
              <div className="relative cursor-pointer text-gray-500 hover:text-[#002f5e] transition-colors flex items-center">
                <BellOutlined className="text-[22px] stroke-current" style={{ strokeWidth: 20 }} />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#ef4444] rounded-full border-2 border-white transform translate-x-1/3 -translate-y-1/3"></span>
              </div>

              {/* Đăng tin button */}
              <button
                onClick={() => navigate('/posts/new')}
                className="flex items-center gap-2 px-4 py-2 bg-[#002f5e] text-white rounded-full font-bold text-[14px] hover:bg-[#001d3a] transition-colors ml-1 shadow-sm whitespace-nowrap shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Đăng tin
              </button>

              {/* User Dropdown */}
              <Dropdown menu={{ items: userMenu }} placement="bottomRight" trigger={['click']} overlayStyle={{ minWidth: 240 }}>
                <div className="flex items-center gap-3 cursor-pointer p-1.5 pr-3 rounded-full border border-[#e0e0e0] hover:bg-white hover:shadow-sm transition-all bg-[#f5f5f54c] ml-1 shrink-0">
                  <div className="w-9 h-9 bg-[#254b86] text-white rounded-full flex items-center justify-center font-bold text-lg shrink-0">
                    {user.fullName?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <span className="font-semibold text-[#254b86] hidden sm:block max-w-[120px] truncate">
                    {user.fullName || user.username}
                  </span>
                  <svg className="hidden sm:block text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
              </Dropdown>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="h-12 px-4 bg-white rounded-[10px] border border-solid border-[#254b86] font-a font-[number:var(--a-font-weight)] text-variable-collection-general-900 hover:bg-gray-50 transition-colors"
              >
                Đăng Nhập
              </button>
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="h-12 px-[30px] bg-variable-collection-primary-800 rounded-[10px] font-a font-[number:var(--a-font-weight)] text-white hover:bg-[#1e3d6b] transition-colors"
              >
                Đăng Ký
              </button>
            </>
          )}
        </div>

      </nav>
    </header>
  );
};

export default PublicHeader;