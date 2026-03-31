import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { profileApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui';
import type { User } from '@/types';

const ProfilePage: React.FC = () => {
    const [profileData, setProfileData] = useState({ fullName: '', email: '', phone: '', address: '' });
    const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
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
        } catch {
            toast.error('Lỗi tải thông tin');
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
            toast.success('Cập nhật thành công');
        } catch {
            toast.error('Cập nhật thất bại');
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
            errors.newPassword = 'Tối thiểu 6 ký tự';
        }
        if (!passwordData.confirmPassword) {
            errors.confirmPassword = 'Vui lòng xác nhận';
        } else if (passwordData.newPassword !== passwordData.confirmPassword) {
            errors.confirmPassword = 'Mật khẩu không khớp';
        }
        setPwErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validatePassword()) return;
        setPwLoading(true);
        try {
            const values = { oldPassword: passwordData.oldPassword, newPassword: passwordData.newPassword };
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

    const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none';
    const errorInputClass = 'w-full rounded-lg border border-error-500 px-3 py-2 text-sm focus:border-error-500 focus:ring-1 focus:ring-error-500 outline-none';

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Hồ sơ cá nhân</h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Profile Info */}
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
                                Cập nhật
                            </Button>
                        </form>
                    </div>
                </div>

                {/* Change Password */}
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
                                {pwErrors.oldPassword && <p className="text-xs text-error-500 mt-1">{pwErrors.oldPassword}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                                <input
                                    type="password"
                                    className={pwErrors.newPassword ? errorInputClass : inputClass}
                                    value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                />
                                {pwErrors.newPassword && <p className="text-xs text-error-500 mt-1">{pwErrors.newPassword}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
                                <input
                                    type="password"
                                    className={pwErrors.confirmPassword ? errorInputClass : inputClass}
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                />
                                {pwErrors.confirmPassword && <p className="text-xs text-error-500 mt-1">{pwErrors.confirmPassword}</p>}
                            </div>
                            <Button variant="primary" type="submit" loading={pwLoading}>
                                Đổi mật khẩu
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
