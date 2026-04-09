import { createBrowserRouter } from "react-router-dom";
import {
  AdminLayout,
  EmployeeLayout,
  PublicLayout,
} from "@/components/layouts";
import { ProtectedRoute } from "@/components/common";

// Public pages
import HomePage from "@/pages/public/HomePage";
import HouseListPage from "@/pages/public/HouseListPage";
import HouseDetailPage from "@/pages/public/HouseDetailPage";
import LandListPage from "@/pages/public/LandListPage";
import LandDetailPage from "@/pages/public/LandDetailPage";
import MyPostsPage from "@/pages/public/MyPostsPage";
import NewsPage from "@/pages/public/NewsPage";
import NewsDetailPage from "@/pages/public/NewsDetailPage";
import FavoritesPage from "@/pages/public/FavoritesPage";
import AboutMe from "@/pages/public/AboutMe";
import PostFormPage from "@/pages/public/PostFormPage";
import VIPUpgradePage from "@/pages/public/VIPUpgradePage";
import PaymentSuccessPage from "@/pages/public/PaymentSuccessPage";
import VNPayCallbackPage from "@/pages/public/VNPayCallbackPage";
import AppointmentBookingPage from "@/pages/public/AppointmentBookingPage";
import PaymentResultPage from "@/pages/public/PaymentResultPage";
import FengshuiPage from "@/pages/public/FengShui";

// Auth pages
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ConfirmOTP from "@/pages/auth/ConfirmOTP";
import PublicProfilePage from "@/pages/auth/ProfilePage";

// Admin pages
import DashboardPage from "@/pages/admin/DashboardPage";
import HouseManagementPage from "@/pages/admin/HouseManagementPage";
import HouseFormPage from "@/pages/admin/HouseFormPage";
import LandManagementPage from "@/pages/admin/LandManagementPage";
import LandFormPage from "@/pages/admin/LandFormPage";
import PostManagementPage from "@/pages/admin/PostManagementPage";
import AppointmentManagementPage from "@/pages/admin/AppointmentManagementPage";
import AppointmentFormPage from "@/pages/admin/AppointmentFormPage";
import AppointmentCalendarPage from "@/pages/admin/AppointmentCalendarPage";
import UserManagementPage from "@/pages/admin/UserManagementPage";
import CustomerManagementPage from "@/pages/admin/CustomerManagementPage";
import EmployeeManagementPage from "@/pages/admin/EmployeeManagementPage";
import RoleManagementPage from "@/pages/admin/RoleManagementPage";
import CategoryManagementPage from "@/pages/admin/CategoryManagementPage";
import FavoriteManagementPage from "@/pages/admin/FavoriteManagementPage";
import ProfilePage from "@/pages/admin/ProfilePage";
import PaymentHistoryPage from "@/pages/admin/PaymentHistoryPage";
import VipPackageManagementPage from "@/pages/admin/VipPackageManagementPage";
import VipPackageFormPage from "@/pages/admin/VipPackageFormPage";

// Employee pages
import EmployeeAppointmentPage from "@/pages/employee/EmployeeAppointmentPage";
import EmployeeCalendarPage from "@/pages/employee/EmployeeCalendarPage";

const router = createBrowserRouter([
  // AUTH
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/otp", element: <ConfirmOTP /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },

  // PUBLIC
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "houses", element: <HouseListPage /> },
      { path: "houses/:id", element: <HouseDetailPage /> },
      { path: "lands", element: <LandListPage /> },
      { path: "lands/:id", element: <LandDetailPage /> },

      // Posts
      { path: "posts", element: <NewsPage /> },
      { path: "posts/:id", element: <NewsDetailPage /> },
      {
        path: "posts/new",
        element: (
          <ProtectedRoute>
            <PostFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "posts/:id/edit",
        element: (
          <ProtectedRoute>
            <PostFormPage />
          </ProtectedRoute>
        ),
      },

      { path: "about", element: <AboutMe /> },
      { path: "fengshui", element: <FengshuiPage /> },

      {
        path: "appointment",
        element: (
          <ProtectedRoute requiredRoles={["CUSTOMER"]}>
            <AppointmentBookingPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "favorites",
        element: (
          <ProtectedRoute>
            <FavoritesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "my-posts",
        element: (
          <ProtectedRoute>
            <MyPostsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "vip-upgrade",
        element: (
          <ProtectedRoute>
            <VIPUpgradePage />
          </ProtectedRoute>
        ),
      },
    ],
  },

  // PAYMENT
  { path: "/payment/result", element: <PaymentResultPage /> },
  { path: "/payment/success", element: <PaymentSuccessPage /> },
  { path: "/payment/failed", element: <PaymentResultPage /> },
  { path: "/payment/vnpay-callback", element: <VNPayCallbackPage /> },

  {
    path: "/profile",
    element: (
      <ProtectedRoute>
        <PublicProfilePage />
      </ProtectedRoute>
    ),
  },

  // ADMIN
  {
    path: "/admin",
    element: (
      <ProtectedRoute requiredRoles={["ADMIN"]}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },

      { path: "houses", element: <HouseManagementPage /> },
      { path: "houses/create", element: <HouseFormPage /> },
      { path: "houses/:id/edit", element: <HouseFormPage /> },

      { path: "lands", element: <LandManagementPage /> },
      { path: "lands/create", element: <LandFormPage /> },
      { path: "lands/:id/edit", element: <LandFormPage /> },

      { path: "posts", element: <PostManagementPage /> },

      { path: "appointments", element: <AppointmentManagementPage /> },
      { path: "appointments/calendar", element: <AppointmentCalendarPage /> },
      { path: "appointments/create", element: <AppointmentFormPage /> },
      { path: "appointments/:id/edit", element: <AppointmentFormPage /> },

      { path: "users", element: <UserManagementPage /> },
      { path: "customers", element: <CustomerManagementPage /> },
      { path: "employees", element: <EmployeeManagementPage /> },

      { path: "roles", element: <RoleManagementPage /> },
      { path: "categories", element: <CategoryManagementPage /> },

      { path: "favorites", element: <FavoriteManagementPage /> },
      { path: "profile", element: <ProfilePage /> },

      { path: "payment-history", element: <PaymentHistoryPage /> },
      { path: "vip-packages", element: <VipPackageManagementPage /> },
      { path: "vip-packages/create", element: <VipPackageFormPage /> },
      { path: "vip-packages/:id/edit", element: <VipPackageFormPage /> },
    ],
  },

  // EMPLOYEE
  {
    path: "/employee",
    element: (
      <ProtectedRoute requiredRoles={["EMPLOYEE"]}>
        <EmployeeLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <EmployeeAppointmentPage /> },
      { path: "appointments", element: <EmployeeAppointmentPage /> },
      { path: "calendar", element: <EmployeeCalendarPage /> },
      { path: "profile", element: <ProfilePage /> },
    ],
  },
]);

export default router;
