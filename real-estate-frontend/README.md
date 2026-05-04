# 🎨 Real Estate Frontend — React 19

Giao diện người dùng cho nền tảng bất động sản, xây dựng bằng **React 19** + **TypeScript** + **Vite**.

## 📐 Cấu trúc

```
src/
├── main.tsx                      # Entry point + React Router
├── App.tsx                       # Root layout + route definitions
├── pages/                        # 50+ page components
│   ├── auth/                     #   Xác thực
│   │   ├── LoginPage.tsx         #     Đăng nhập (JWT + Google OAuth)
│   │   ├── RegisterPage.tsx      #     Đăng ký + OTP email
│   │   ├── ConfirmOTP.tsx        #     Xác thực mã OTP
│   │   ├── ForgotPasswordPage.tsx#     Quên mật khẩu
│   │   └── ProfilePage.tsx       #     Hồ sơ cá nhân
│   │
│   ├── public/                   #   Trang công khai
│   │   ├── HomePage.tsx          #     Trang chủ (AI Recommendations, Featured, Banner)
│   │   ├── HouseListPage.tsx     #     Danh sách nhà (filter + pagination)
│   │   ├── HouseDetailPage.tsx   #     Chi tiết nhà (gallery + map + booking)
│   │   ├── LandListPage.tsx      #     Danh sách đất
│   │   ├── LandDetailPage.tsx    #     Chi tiết đất
│   │   ├── NewsPage.tsx          #     Bài viết / tin tức
│   │   ├── NewsDetailPage.tsx    #     Chi tiết bài viết
│   │   ├── PostFormPage.tsx      #     Tạo/sửa bài đăng (CKEditor 5)
│   │   ├── MyPostsPage.tsx       #     Bài viết của tôi
│   │   ├── FavoritesPage.tsx     #     Yêu thích BĐS
│   │   ├── AppointmentBookingPage#     Đặt lịch hẹn xem BĐS
│   │   ├── MyAppointmentsPage.tsx#     Lịch hẹn của tôi
│   │   ├── VIPUpgradePage.tsx    #     Nâng cấp VIP (bài đăng + tài khoản)
│   │   ├── ValuationPage.tsx     #     Định giá BĐS bằng AI
│   │   ├── FengShui.tsx          #     Phong thuỷ (bát trạch, mệnh cung)
│   │   ├── VNPayCallbackPage.tsx #     Callback thanh toán VNPay
│   │   ├── MomoPayCallbackPage.tsx#    Callback thanh toán MoMo
│   │   └── AboutMe.tsx           #     Giới thiệu
│   │
│   ├── admin/                    #   Quản trị (ADMIN role)
│   │   ├── DashboardPage.tsx     #     Dashboard 7 tab KPI
│   │   ├── HouseManagementPage   #     Quản lý nhà
│   │   ├── LandManagementPage    #     Quản lý đất
│   │   ├── PostManagementPage    #     Duyệt bài đăng
│   │   ├── AppointmentManagement #     Quản lý lịch hẹn + Calendar
│   │   ├── UserManagementPage    #     Quản lý người dùng
│   │   ├── EmployeeManagement    #     Quản lý nhân viên
│   │   ├── DepositManagementPage #     Quản lý đặt cọc
│   │   ├── VipPackageManagement  #     Quản lý gói VIP
│   │   ├── RevenueManagementPage #     Quản lý doanh thu
│   │   ├── analytics/            #     6 báo cáo chi tiết (Recharts)
│   │   └── ...                   #     Role, Category, Customer, etc.
│   │
│   └── employee/                 #   Nhân viên (EMPLOYEE role)
│       ├── EmployeeDashboardPage #     Dashboard nhân viên
│       ├── EmployeeAppointmentPage#    Lịch hẹn được phân công
│       └── EmployeeCalendarPage  #     Calendar FullCalendar
│
├── components/                   # Reusable components
│   ├── common/                   #   ChatbotWidget, PropertyCard, etc.
│   └── layout/                   #   AdminLayout, PublicLayout, etc.
│
├── api/                          # Axios API layer
│   ├── client.ts                 #   Axios instance + interceptors
│   ├── recommendation.ts         #   Recommendation API
│   ├── appointment.ts            #   Appointment API
│   └── ...                       #   Theo từng module
│
├── stores/                       # Zustand state management
│   ├── authStore.ts              #   Auth state (user, token, role)
│   └── ...
│
└── types/                        # TypeScript interfaces
```

## 🚀 Khởi chạy

### Qua Docker (khuyến nghị)

Frontend chạy tự động trong Docker Compose. Xem [README gốc](../README.md).

### Chạy local

```bash
# 1. Cài đặt dependencies
npm install

# 2. Cấu hình env
# Tạo file .env hoặc .env.local
VITE_API_BASE_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id

# 3. Chạy dev server
npm run dev
```

Frontend chạy tại `http://localhost:3000`

## 📦 Scripts

```bash
npm run dev           # Dev server (Vite HMR)
npm run build         # Production build
npm run build:strict  # Build với typecheck
npm run typecheck     # TypeScript check (không build)
npm run lint          # ESLint
npm run preview       # Preview production build
```

## 🛠️ Tech Stack

| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| React | 19.2 | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 7.3 | Build tool + HMR |
| Ant Design | 6.3 | UI component library |
| TailwindCSS | 3.4 | Utility-first CSS |
| Zustand | 5.0 | Lightweight state management |
| TanStack React Query | 5.x | Server state + caching |
| React Router | 7.x | Client-side routing |
| Axios | 1.x | HTTP client |
| Recharts | 3.8 | Charts cho admin dashboard |
| FullCalendar | 6.x | Calendar view lịch hẹn |
| CKEditor 5 | - | Rich text editor bài đăng |
| Lucide React | - | Icon library |
| DOMPurify | - | Sanitize HTML content |
| Day.js | - | Date/time formatting |
| jsPDF + ExcelJS | - | Export PDF/Excel |

## 🔑 Phân quyền Routes

| Prefix | Role | Guard |
|--------|------|-------|
| `/admin/*` | ADMIN | `PrivateRoute` + role check |
| `/employee/*` | EMPLOYEE | `PrivateRoute` + role check |
| `/profile`, `/favorites`, `/my-posts` | Authenticated | `PrivateRoute` |
| `/`, `/houses`, `/lands`, `/posts` | Public | Không yêu cầu đăng nhập |

## 💡 Quy ước

- **File naming**: PascalCase cho pages/components (`HouseDetailPage.tsx`)
- **API layer**: Mỗi module có file API riêng trong `src/api/`
- **State**: Zustand store cho auth, React Query cho server state
- **Styling**: TailwindCSS utility classes + Ant Design theme
- **Toast**: `react-hot-toast` cho notifications
