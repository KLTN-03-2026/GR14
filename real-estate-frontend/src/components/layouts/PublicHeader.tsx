import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dropdown, type MenuProps } from 'antd';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import group from "../../assets/logo.png";

const navigationItems = [
  { label: "Trang Chủ", href: "/" },
  { label: "Nhà Ở", href: "/houses" },
  { label: "Đất Đai", href: "/lands" },
  { label: "Bài Viết", href: "/posts" },
  { label: "Đăng Bài Viết", href: "/posts/new" },
  { label: "Về Chúng Tôi", href: "/about" },
  { label: "Phong Thủy", href: "/fengshui" },
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

  const userMenu: MenuProps['items'] = isAdmin ? [
    {
      key: 'admin-panel',
      label: <Link to="/admin">Về quản trị</Link>,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      danger: true,
      label: <span onClick={handleLogout}>Đăng xuất</span>,
    },
  ] : isEmployee ? [
    {
      key: 'employee-panel',
      label: <Link to="/employee">Về quản trị nhân viên</Link>,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      danger: true,
      label: <span onClick={handleLogout}>Đăng xuất</span>,
    },
  ] : [
    {
      key: '1',
      label: <Link to="/profile">Thông tin tài khoản</Link>,
    },
    {
      key: 'favorites',
      label: <Link to="/favorites">Danh sách yêu thích</Link>,
    },
    {
      key: 'my-posts',
      label: <Link to="/my-posts">Bài viết của tôi</Link>,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      danger: true,
      label: <span onClick={handleLogout}>Đăng xuất</span>,
    },
  ];

  return (
    <header className="flex h-20 items-center justify-center gap-2.5 p-2.5 w-full bg-[#f5f5f54c] sticky top-0 z-[100] shadow-sm backdrop-blur-md">
      <nav className="flex w-full max-w-[1290px] items-center justify-between" aria-label="Main navigation">

        {/* PHẦN TRÁI: Logo */}
        <div className="flex-1 flex justify-start items-center">
          <Link to="/" className="flex items-center gap-2" aria-label="Black'S City Home">
            <img className="w-[45px] h-8" alt="Black'S City Logo" src={group} />
            <div className="font-black text-variable-collection-primary-800 text-[22px] leading-7 whitespace-nowrap">
              Black'S City
            </div>
          </Link>
        </div>

        {/* PHẦN GIỮA: Navigation */}
        <ul className="hidden lg:flex flex-1 justify-center items-center gap-5"> {/* Giảm gap xuống gap-5 */}
          {navigationItems.map((item, index) => (
            <li key={index}>
              <Link
                to={item.href}
                onClick={item.href === '/posts/new' ? handleCreatePostClick : undefined}
                // Thêm whitespace-nowrap vào dòng className bên dưới:
                className="whitespace-nowrap font-a font-[number:var(--a-font-weight)] text-variable-collection-general-900 text-[length:var(--a-font-size)] hover:text-blue-600 transition-colors"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* PHẦN PHẢI: Buttons & User Menu */}
        <div className="flex-1 flex justify-end items-center gap-4">
          {isAuthenticated && user ? (
            /* NẾU ĐÃ ĐĂNG NHẬP: Hiện tên và Avatar */
            <Dropdown menu={{ items: userMenu }} placement="bottomRight" trigger={['click']}>
              <div className="flex items-center gap-3 cursor-pointer p-1.5 pr-3 rounded-full border border-[#e0e0e0] hover:bg-white hover:shadow-sm transition-all bg-[#f5f5f54c]">
                <div className="w-9 h-9 bg-[#254b86] text-white rounded-full flex items-center justify-center font-bold text-lg">
                  {user.fullName?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span className="font-semibold text-[#254b86] hidden sm:block max-w-[120px] truncate">
                  {user.fullName || user.username}
                </span>
              </div>
            </Dropdown>
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