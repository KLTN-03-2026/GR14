import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { profileApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui';
import type { User } from '@/types';

const ProfilePage: React.FC = () => {
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
  });

  const [vipData, setVipData] = useState({
    isVip: false,
    vipExpiry: null as string | null,
  });

  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

  const { setUser } = useAuthStore();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await profileApi.getProfile();
      const user: User = res.data.data || res.data;

      setProfileData({
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
      });

      const expiryDate = user.vipExpiry
        ? new Date(user.vipExpiry).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : null;

      setVipData({
        isVip: !!user.isVip,
        vipExpiry: expiryDate,
      });
    } catch (error) {
      toast.error('Lỗi tải thông tin hồ sơ');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const values: Record<string, unknown> = { ...profileData };
      const res = await profileApi.updateProfile(values);
      const updatedUser = res.data.data || res.data;
      setUser(updatedUser);
      toast.success('Cập nhật hồ sơ thành công');
    } catch {
      toast.error('Cập nhật hồ sơ thất bại');
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (): boolean => {
    const errors: Record<string, string> = {};
    if (!passwordData.oldPassword) errors.oldPassword = 'Vui lòng nhập mật khẩu cũ';
    if (!passwordData.newPassword) {
      errors.newPassword = 'Vui lòng nhập mật khẩu mới';
    } else if (passwordData.newPassword.length < 6) {
      errors.newPassword = 'Mật khẩu mới phải có ít nhất 6 ký tự';
    }
    if (!passwordData.confirmPassword) {
      errors.confirmPassword = 'Vui lòng xác nhận mật khẩu';
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }
    setPwErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePassword()) return;

    setPwLoading(true);
    try {
      const values = {
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword,
      };
      await profileApi.changePassword(values);
      toast.success('Đổi mật khẩu thành công');
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setPwErrors({});
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Đổi mật khẩu thất bại');
    } finally {
      setPwLoading(false);
    }
  };

// Xử lý nâng cấp VIP tài khoản
const handleUpgradeAccountVIP = async () => {
  try {
    toast('Đang chuyển đến trang chọn gói VIP tài khoản...', {
      icon: 'ℹ️',
      duration: 2000,
    });
    
    window.location.href = '/vip-upgrade?type=account';   // ← Sửa thành vip-upgrade
  } catch (error) {
    toast.error('Không thể khởi tạo nâng cấp VIP. Vui lòng thử lại sau.');
  }
};

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none';
  const errorInputClass = 'w-full rounded-lg border border-error-500 px-3 py-2 text-sm focus:border-error-500 focus:ring-1 focus:ring-error-500 outline-none';

  return (
    <div className="space-y-8">
      <h3 className="text-xl font-semibold text-gray-900">Hồ sơ cá nhân</h3>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Thông tin cá nhân */}
        <div className="md:col-span-7">
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6 py-4">
              <h4 className="text-base font-semibold text-gray-900">Thông tin cá nhân</h4>
            </div>
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên</label>
                <input
                  type="text"
                  className={inputClass}
                  value={profileData.fullName}
                  onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  className={inputClass}
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  className={inputClass}
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                <input
                  type="text"
                  className={inputClass}
                  value={profileData.address}
                  onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                />
              </div>
              <Button variant="primary" type="submit" loading={loading}>
                Cập nhật thông tin
              </Button>
            </form>
          </div>
        </div>

        {/* Đổi mật khẩu */}
        <div className="md:col-span-5">
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6 py-4">
              <h4 className="text-base font-semibold text-gray-900">Đổi mật khẩu</h4>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu cũ</label>
                <input
                  type="password"
                  className={pwErrors.oldPassword ? errorInputClass : inputClass}
                  value={passwordData.oldPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                />
                {pwErrors.oldPassword && (
                  <p className="text-xs text-error-500 mt-1">{pwErrors.oldPassword}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  className={pwErrors.newPassword ? errorInputClass : inputClass}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                />
                {pwErrors.newPassword && (
                  <p className="text-xs text-error-500 mt-1">{pwErrors.newPassword}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  className={pwErrors.confirmPassword ? errorInputClass : inputClass}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                />
                {pwErrors.confirmPassword && (
                  <p className="text-xs text-error-500 mt-1">{pwErrors.confirmPassword}</p>
                )}
              </div>
              <Button variant="primary" type="submit" loading={pwLoading}>
                Đổi mật khẩu
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* ==================== NÂNG CẤP TÀI KHOẢN VIP ==================== */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h4 className="text-base font-semibold text-gray-900">Nâng cấp tài khoản VIP</h4>
          {vipData.isVip && (
            <span className="px-4 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
              Đang là thành viên VIP
            </span>
          )}
        </div>

        <div className="p-6">
          {vipData.isVip ? (
            <div className="flex flex-col gap-3">
              <p className="text-green-600 font-semibold text-lg">
                Chúc mừng! Tài khoản của bạn đang là VIP
              </p>
              <p className="text-gray-600">
                Hạn sử dụng: <span className="font-medium text-gray-900">{vipData.vipExpiry}</span>
              </p>
              <p className="text-sm text-gray-500">
                Tất cả bài viết của bạn đã được tự động nâng cấp thành VIP và sẽ duy trì đến ngày hết hạn.
              </p>
              <Button variant="outline" disabled className="w-fit">
                Đã kích hoạt VIP
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-gray-700 leading-relaxed">
                  Nâng cấp lên <span className="font-semibold text-brand-600">tài khoản VIP</span> để:
                </p>
                <ul className="mt-3 space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    Tất cả bài viết (kể cả bài đang thường) sẽ tự động thành VIP
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    Ưu tiên hiển thị bài viết trên trang chủ và tìm kiếm
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    Nhiều quyền lợi đặc biệt khác
                  </li>
                </ul>
              </div>

              {/* Button đã sửa: bỏ size="lg" */}
              <Button
                variant="primary"
                onClick={handleUpgradeAccountVIP}
                className="w-full md:w-auto"
              >
                Nâng cấp tài khoản VIP ngay
              </Button>

              <p className="text-xs text-gray-500 italic">
                💡 Sau khi thanh toán thành công, hệ thống sẽ tự động cập nhật tất cả bài viết của bạn thành VIP.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;