import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dropdown, type MenuProps } from 'antd';
import { 
  UserOutlined, 
  FileTextOutlined, 
  HeartOutlined, 
  CalendarOutlined, 
  CrownOutlined, 
  LogoutOutlined,
  SettingOutlined,
  TeamOutlined 
} from '@ant-design/icons';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import group from "../../assets/logo.png";
import NotificationDropdown from '@/components/common/NotificationDropdown';

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

  // Logic VIP
  let vipText = 'Thành viên';
  let isVipActive = false;
  if (user?.isVip && user?.vipExpiry) {
    const expiryDate = new Date(user.vipExpiry);
    const now = new Date();
    const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      isVipActive = true;
      vipText = `VIP - còn ${diffDays} ngày`;
    }
  }

  // Khởi tạo Menu Items
  const menuItems: MenuProps['items'] = [
    {
      key: 'user-info',
      label: (
        <div className="flex items-center gap-3 py-2 cursor-default">
          <div className="w-10 h-10 bg-[#254b86] text-white rounded-full flex items-center justify-center font-bold shrink-0">
            {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-gray-800">{user?.fullName || user?.username}</span>
            <span className={`text-[11px] font-semibold ${isVipActive ? 'text-amber-600' : 'text-gray-400'}`}>
              {vipText}
            </span>
          </div>
        </div>
      ),
    },
    { type: 'divider' },
    ...(isAdmin ? [{
      key: 'admin',
      label: <Link to="/admin" className="flex items-center gap-2"><SettingOutlined /> Quản trị Admin</Link>
    }] : []),
    ...(isEmployee ? [{
      key: 'employee',
      label: <Link to="/employee" className="flex items-center gap-2"><TeamOutlined /> Quản trị nhân viên</Link>
    }] : []),
    {
      key: 'profile',
      label: <Link to="/profile" className="flex items-center gap-2"><UserOutlined /> Hồ sơ cá nhân</Link>
    },
    {
      key: 'my-posts',
      label: <Link to="/my-posts" className="flex items-center gap-2"><FileTextOutlined /> Bài viết của tôi</Link>
    },

    {
  key: 'appointments',
  label: <Link to="/appointment" className="flex items-center gap-2">
           <CalendarOutlined /> Lịch hẹn của tôi
         </Link>
}, 

    {
      key: 'favorites',
      label: <Link to="/favorites" className="flex items-center gap-2"><HeartOutlined /> Yêu thích</Link>
    },
    ...(!isVipActive ? [{
      key: 'vip',
      label: <Link to="/vip-upgrade" className="flex items-center gap-2 text-amber-600 font-bold"><CrownOutlined /> Nâng cấp VIP</Link>
    }] : []),
    { type: 'divider' },
    {
      key: 'logout',
      danger: true,
      label: <div onClick={handleLogout} className="flex items-center gap-2"><LogoutOutlined /> Đăng xuất</div>
    }
  ];

  return (
    <header className="flex h-20 items-center justify-center w-full bg-white/80 sticky top-0 z-[100] shadow-sm backdrop-blur-md px-4">
      <nav className="flex w-full max-w-[1290px] items-center justify-between">
        
        {/* LOGO */}
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <img className="w-10 h-7 object-contain" alt="Logo" src={group} />
            <span className="font-black text-[#254b86] text-xl hidden sm:block">Black'S City</span>
          </Link>
        </div>

        {/* NAVIGATION */}
        <ul className="hidden lg:flex items-center gap-6">
          {navigationItems.map((item, index) => (
            <li key={index}>
              <Link
                to={item.href}
                onClick={item.href === '/posts/new' ? handleCreatePostClick : undefined}
                className="text-gray-700 font-medium hover:text-[#254b86] transition-colors relative"
              >
                {item.label}
                {item.label === 'Định giá AI' && (
                  <span className="absolute -top-3 -right-6 px-1 bg-teal-100 text-[#00a884] text-[9px] rounded font-bold">AI</span>
                )}
              </Link>
            </li>
          ))}
        </ul>

        {/* ACTIONS */}
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <Link to="/favorites" className="text-gray-500 hover:text-red-500 transition-colors">
                <HeartOutlined className="text-xl" />
              </Link>
              <NotificationDropdown />
              <button
                onClick={() => navigate('/posts/new')}
                className="hidden md:block px-4 py-2 bg-[#254b86] text-white rounded-full text-sm font-bold hover:bg-[#1a355f] transition-all"
              >
                + Đăng tin
              </button>
              <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
                <div className="flex items-center gap-2 cursor-pointer p-1 border rounded-full hover:shadow-md transition-all">
                  <div className="w-8 h-8 bg-[#254b86] text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                </div>
              </Dropdown>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => navigate('/login')} className="px-4 py-2 text-[#254b86] font-bold">Đăng Nhập</button>
              <button onClick={() => navigate('/register')} className="px-5 py-2 bg-[#254b86] text-white rounded-lg font-bold">Đăng Ký</button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
};

export default PublicHeader;