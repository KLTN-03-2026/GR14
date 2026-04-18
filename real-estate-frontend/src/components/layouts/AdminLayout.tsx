import { useState, useCallback, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "@/stores/authStore";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { Dropdown, DropdownItem } from "@/components/ui";

// ─── Icons (inline SVG to replace @ant-design/icons) ─────────
const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
      clipRule="evenodd"
    />
  </svg>
);

// ─── Menu configuration ──────────────────────────────────────
type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string }[];
};

const navItems: NavItem[] = [
  {
    name: "Dashboard",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
        />
      </svg>
    ),
    path: "/admin",
  },
  {
    name: "Nhà",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21"
        />
      </svg>
    ),
    path: "/admin/houses",
  },
  {
    name: "Đất",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
        />
      </svg>
    ),
    path: "/admin/lands",
  },
  {
    name: "Bài đăng",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
    ),
    path: "/admin/posts",
  },
  {
    name: "Lịch hẹn",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
        />
      </svg>
    ),
    path: "/admin/appointments",
  },
  {
    name: "Điều phối lịch",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 3v2.25M17.25 3v2.25M3 8.25h18M4.5 6.75h15a1.5 1.5 0 011.5 1.5v11.25A1.5 1.5 0 0119.5 21h-15A1.5 1.5 0 013 19.5V8.25a1.5 1.5 0 011.5-1.5z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.25 12h3.75M8.25 15.75h7.5M14.25 12h1.5"
        />
      </svg>
    ),
    path: "/admin/appointments/calendar",
  },
  {
    name: "Danh mục BĐS",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 018.25 20.25H6A2.25 2.25 0 013.75 18v-2.25z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
        />
      </svg>
    ),
    path: "/admin/categories",
  },
  {
    name: "Quản lý người dùng",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
      </svg>
    ),
    subItems: [
      { name: "Người dùng", path: "/admin/users" },
      { name: "Khách hàng", path: "/admin/customers" },
      { name: "Nhân viên", path: "/admin/employees" },
    ],
  },
  {
    name: "Vai trò",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    ),
    path: "/admin/roles",
  },
  {
    name: "Lịch sử thanh toán",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
        />
      </svg>
    ),
    path: "/admin/payment-history",
  },
  {
    name: "Gói VIP",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.499a.5.5 0 011.04 0V6h3a2 2 0 012 2v4a2 2 0 01-2 2h-3v2.97a.75.75 0 01-1.06.73l-5.7-3.73a.75.75 0 010-1.26l5.7-3.73a.75.75 0 011.06.73V9h-3V7a2 2 0 012-2h3V3.5z"
        />
      </svg>
    ),
    path: "/admin/vip-packages",
  },
];

// ─── Sidebar Component ───────────────────────────────────────
const Sidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<number, number>>(
    {},
  );
  const subMenuRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname],
  );

  useEffect(() => {
    navItems.forEach((nav, index) => {
      if (nav.subItems?.some((sub) => isActive(sub.path))) {
        setOpenSubmenu(index);
      }
    });
  }, [location.pathname, isActive]);

  useEffect(() => {
    if (openSubmenu !== null && subMenuRefs.current[openSubmenu]) {
      setSubMenuHeight((prev) => ({
        ...prev,
        [openSubmenu]: subMenuRefs.current[openSubmenu]?.scrollHeight || 0,
      }));
    }
  }, [openSubmenu]);

  const sidebarExpanded = isExpanded || isHovered || isMobileOpen;

  return (
    <aside
      className={`fixed top-0 left-0 flex flex-col h-screen bg-gray-950 text-white transition-all duration-300 ease-in-out z-50 border-r border-gray-800/80 shadow-theme-md
                ${sidebarExpanded ? "w-[260px]" : "w-[80px]"}
                ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <div
        className={`flex items-center h-16 px-5 border-b border-gray-800/80 ${!sidebarExpanded ? "justify-center" : ""}`}
      >
        <Link
          to="/admin"
          className="text-white font-bold text-lg tracking-tight"
        >
          {sidebarExpanded ? "Black'S City" : "BC"}
        </Link>
      </div>

      {/* Menu */}
      <div className="flex-1 overflow-y-auto py-4 px-3">
        <nav className="flex flex-col gap-1">
          {navItems.map((nav, index) => (
            <div key={nav.name}>
              {nav.subItems ? (
                <button
                  onClick={() =>
                    setOpenSubmenu(openSubmenu === index ? null : index)
                  }
                  className={`flex items-center w-full gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    openSubmenu === index
                      ? "bg-brand-500/20 text-brand-200"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  } ${!sidebarExpanded ? "justify-center" : ""}`}
                >
                  <span className="flex-shrink-0">{nav.icon}</span>
                  {sidebarExpanded && (
                    <>
                      <span className="flex-1 text-left">{nav.name}</span>
                      <ChevronDownIcon
                        className={`w-4 h-4 transition-transform duration-200 ${
                          openSubmenu === index ? "rotate-180" : ""
                        }`}
                      />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => {
                    navigate(nav.path!);
                  }}
                  className={`flex items-center w-full gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    isActive(nav.path!)
                      ? "bg-brand-500 text-white shadow-theme-sm"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  } ${!sidebarExpanded ? "justify-center" : ""}`}
                >
                  <span className="flex-shrink-0">{nav.icon}</span>
                  {sidebarExpanded && <span>{nav.name}</span>}
                </button>
              )}

              {/* Sub menu */}
              {nav.subItems && sidebarExpanded && (
                <div
                  ref={(el) => {
                    subMenuRefs.current[index] = el;
                  }}
                  className="overflow-hidden transition-all duration-300"
                  style={{
                    height:
                      openSubmenu === index
                        ? `${subMenuHeight[index] || 0}px`
                        : "0px",
                  }}
                >
                  <div className="mt-1 ml-8 space-y-0.5">
                    {nav.subItems.map((sub) => (
                      <button
                        key={sub.path}
                        onClick={() => navigate(sub.path)}
                        className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive(sub.path)
                            ? "text-brand-200 bg-brand-500/20"
                            : "text-gray-400 hover:text-gray-200"
                        }`}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
};

// ─── Backdrop ────────────────────────────────────────────────
const Backdrop: React.FC = () => {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar();
  if (!isMobileOpen) return null;
  return (
    <div
      className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
      onClick={toggleMobileSidebar}
    />
  );
};

// ─── Header ──────────────────────────────────────────────────
const Header: React.FC = () => {
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-[9999] flex items-center justify-between h-16 px-4 lg:px-6 bg-white/80 backdrop-blur-xl border-b border-gray-200 shadow-theme-xs">
      {/* Left: hamburger */}
      <button
        className="flex items-center justify-center w-10 h-10 text-gray-500 rounded-lg hover:bg-gray-100 lg:border lg:border-gray-200"
        onClick={handleToggle}
        aria-label="Toggle Sidebar"
      >
        {isMobileOpen ? (
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        )}
      </button>

      {/* Right: user dropdown */}
      <div className="relative">
        <button
          onClick={() => setUserDropdownOpen(!userDropdownOpen)}
          className="dropdown-toggle flex items-center gap-2 cursor-pointer text-gray-700 hover:text-gray-900"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-brand-100 text-brand-600 font-semibold text-sm">
            {(user?.fullName || user?.username || "A").charAt(0).toUpperCase()}
          </div>
          <span className="hidden sm:inline text-sm font-semibold">
            {user?.fullName || user?.username || "Admin"}
          </span>
          <ChevronDownIcon className="w-4 h-4 text-gray-400" />
        </button>

        <Dropdown
          isOpen={userDropdownOpen}
          onClose={() => setUserDropdownOpen(false)}
          className="w-52"
        >
          <div className="py-1">
            <DropdownItem
              onClick={() => {
                navigate("/admin/profile");
                setUserDropdownOpen(false);
              }}
            >
              <span className="flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                  />
                </svg>
                Hồ sơ cá nhân
              </span>
            </DropdownItem>
            <DropdownItem
              onClick={() => {
                navigate("/");
                setUserDropdownOpen(false);
              }}
            >
              <span className="flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
                Xem trang người dùng
              </span>
            </DropdownItem>
            <div className="border-t border-gray-100 my-1" />
            <DropdownItem onClick={handleLogout} danger>
              <span className="flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                  />
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

// ─── Layout Content ──────────────────────────────────────────
const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered } = useSidebar();

  return (
    <div className="admin-shell min-h-screen">
      <Sidebar />
      <Backdrop />
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "lg:ml-[260px]" : "lg:ml-[80px]"
        }`}
      >
        <Header />
        <main className="p-4 md:p-6 lg:p-7 max-w-[1600px] mx-auto">
          <Outlet />
        </main>
        <Toaster
          position="top-right"
          containerStyle={{ zIndex: 110000 }}
          toastOptions={{
            style: { zIndex: 110000 },
          }}
        />
      </div>
    </div>
  );
};

// ─── AdminLayout ─────────────────────────────────────────────
const AdminLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
};

export default AdminLayout;
