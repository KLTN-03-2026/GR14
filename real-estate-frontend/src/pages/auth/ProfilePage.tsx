import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Tabs, message, Spin, Tag } from 'antd';
import { UserOutlined, PhoneOutlined, HomeOutlined, LockOutlined, MailOutlined, CrownOutlined } from '@ant-design/icons';
import { authApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import PublicHeader from '@/components/layouts/PublicHeader';
import PublicFooter from '@/components/layouts/PublicFooter';

const ProfilePage: React.FC = () => {
    const navigate = useNavigate();
    // Lấy thông tin hiện tại và hàm cập nhật từ Store
    const { user, setUser } = useAuthStore();
    
    const [loadingData, setLoadingData] = useState(true);
    const [loadingSubmit, setLoadingSubmit] = useState(false);
    
    // Khởi tạo 2 form riêng biệt cho 2 tab
    const [formProfile] = Form.useForm();
    const [formPassword] = Form.useForm();

    // Helper function để check VIP còn hạn hay không
    const isVipActive = () => {
        if (!user?.isVip || !user?.vipExpiry) return false;
        return new Date(user.vipExpiry) > new Date();
    };

    // Helper function để format ngày VIP hết hạn
    const formatVipExpiry = () => {
        if (!user?.vipExpiry) return '---';
        const expiryDate = new Date(user.vipExpiry);
        return expiryDate.toLocaleDateString('vi-VN');
    };

    const getVipTierLabel = () => {
        if (!isVipActive()) return 'Không có';
        const level = user?.vipPriorityLevel;
        if (level === 0) return 'VIP 0';
        if (level === 1) return 'VIP 1';
        if (level === 2) return 'VIP 2';
        if (level === 3) return 'VIP 3';

        // Fallback theo tên gói nếu backend chưa trả priority level
        const packageName = String(user?.vipPackageName || '').toLowerCase();
        if (packageName.includes('30')) return 'VIP 3';
        if (packageName.includes('15')) return 'VIP 2';
        if (packageName.includes('7')) return 'VIP 1';
        if (packageName.includes('10k') || packageName.includes('1 lần')) return 'VIP 0';

        return 'VIP';
    };

    // Lấy dữ liệu profile mới nhất từ server khi vào trang
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await authApi.getProfile();
                // Kiểm tra xem backend trả về res.data hay res.data.data
                const profileData = res.data?.data || res.data;
                
                if (profileData) {
                    formProfile.setFieldsValue({
                        username: profileData.username,
                        email: profileData.email,
                        fullName: profileData.fullName,
                        phone: profileData.phone,
                        address: profileData.address,
                    });
                    setUser(profileData);
                }
            } catch (error) {
                console.error("Profile error:", error);
                // message.error('Không thể tải thông tin tài khoản');
            } finally {
                setLoadingData(false);
            }
        };

        fetchProfile();
    }, [formProfile, setUser]);

    // Xử lý Cập nhật thông tin
    const handleUpdateProfile = async (values: any) => {
        setLoadingSubmit(true);
        try {
            const res = await authApi.updateProfile({
                fullName: values.fullName,
                phone: values.phone,
                address: values.address,
            });
            
            message.success('Cập nhật thông tin thành công!');
            
            if (res.data && res.data.data) {
                 setUser({ ...user, ...res.data.data }); 
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Cập nhật thất bại');
        } finally {
            setLoadingSubmit(false);
        }
    };

    // Xử lý Đổi mật khẩu
    const handleChangePassword = async (values: any) => {
        setLoadingSubmit(true);
        try {
            await authApi.changePassword({
                oldPassword: values.oldPassword,
                newPassword: values.newPassword,
            });
            message.success('Đổi mật khẩu thành công!');
            formPassword.resetFields(); 
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Mật khẩu cũ không chính xác');
        } finally {
            setLoadingSubmit(false);
        }
    };

    // Giao diện Tab 1: Thông tin cá nhân
    const ProfileTab = (
        <Form 
            form={formProfile} 
            layout="vertical" 
            onFinish={handleUpdateProfile}
            className="mt-4"
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Form.Item label="Tên tài khoản" name="username">
                    <Input disabled prefix={<UserOutlined className="text-gray-400" />} />
                </Form.Item>

                <Form.Item label="Email" name="email">
                    <Input disabled prefix={<MailOutlined className="text-gray-400" />} />
                </Form.Item>
            </div>

            <Form.Item 
                label="Họ và Tên" 
                name="fullName"
                rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
            >
                <Input prefix={<UserOutlined className="text-gray-400" />} placeholder="Nhập họ và tên của bạn" />
            </Form.Item>

            <Form.Item 
                label="Số điện thoại" 
                name="phone"
                rules={[{ pattern: /^[0-9]{10,11}$/, message: 'Số điện thoại không hợp lệ' }]}
            >
                <Input prefix={<PhoneOutlined className="text-gray-400" />} placeholder="Nhập số điện thoại" />
            </Form.Item>

            <Form.Item label="Địa chỉ" name="address">
                <Input prefix={<HomeOutlined className="text-gray-400" />} placeholder="Nhập địa chỉ của bạn" />
            </Form.Item>

            <Form.Item>
                <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loadingSubmit}
                    className="bg-[#254b86] h-10 px-8 font-semibold mt-2"
                >
                    Lưu Thay Đổi
                </Button>
            </Form.Item>
        </Form>
    );

    // Giao diện Tab 2: Đổi mật khẩu
    const PasswordTab = (
        <Form 
            form={formPassword} 
            layout="vertical" 
            onFinish={handleChangePassword}
            className="mt-4 max-w-md"
        >
            <Form.Item 
                label="Mật khẩu hiện tại" 
                name="oldPassword"
                rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}
            >
                <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="Nhập mật khẩu cũ" />
            </Form.Item>

            <Form.Item 
                label="Mật khẩu mới" 
                name="newPassword"
                rules={[
                    { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                    { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' }
                ]}
            >
                <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="Nhập mật khẩu mới" />
            </Form.Item>

            <Form.Item 
                label="Xác nhận mật khẩu mới" 
                name="confirmPassword"
                dependencies={['newPassword']}
                rules={[
                    { required: true, message: 'Vui lòng xác nhận mật khẩu' },
                    ({ getFieldValue }) => ({
                        validator(_, value) {
                            if (!value || getFieldValue('newPassword') === value) {
                                return Promise.resolve();
                            }
                            return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
                        },
                    }),
                ]}
            >
                <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="Nhập lại mật khẩu mới" />
            </Form.Item>

            <Form.Item>
                <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loadingSubmit}
                    className="bg-[#254b86] h-10 px-8 font-semibold mt-2"
                >
                    Đổi Mật Khẩu
                </Button>
            </Form.Item>
        </Form>
    );

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <PublicHeader />

            <main className="flex-1 container mx-auto px-4 py-10 max-w-5xl">
                <h1 className="text-3xl font-bold text-[#254b86] mb-8">Thông Tin Tài Khoản</h1>

                <div className="flex flex-col md:flex-row gap-8">
                    {/* Cột trái: Card Avatar */}
                    <div className="w-full md:w-1/3">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                            <div className="w-24 h-24 bg-[#254b86] text-white rounded-full flex items-center justify-center font-bold text-4xl mb-4 uppercase shadow-md">
                                {user?.fullName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                            </div>
                            <h2 className="text-xl font-bold text-gray-800">{user?.fullName || user?.username}</h2>
                            <p className="text-gray-500">{user?.email}</p>
                            
                            {/* VIP Badge */}
                            {isVipActive() && (
                                <div className="mt-3 mb-3">
                                    <Tag icon={<CrownOutlined />} color="gold" className="text-sm font-semibold px-3 py-1">
                                        {getVipTierLabel()}
                                    </Tag>
                                </div>
                            )}
                            
                            <div className="w-full border-t border-gray-100 my-4"></div>
                            
                            <div className="w-full flex justify-between text-sm text-gray-600 mb-2">
                                <span>Trạng thái:</span>
                                <span className="font-semibold text-green-600">Đang hoạt động</span>
                            </div>
                            <div className="w-full flex justify-between text-sm text-gray-600 mb-2">
                                <span>Vai trò:</span>
                                <span className="font-semibold">
                                    {user?.roles?.includes('ADMIN') ? 'Quản trị viên' : 'Khách hàng'}
                                </span>
                            </div>
                            <div className="w-full flex justify-between text-sm text-gray-600 mb-2">
                                <span>Gói VIP:</span>
                                <span className={`font-semibold ${isVipActive() ? 'text-[#d97706]' : 'text-red-600'}`}>
                                    {isVipActive() ? getVipTierLabel() : 'Không có'}
                                </span>
                            </div>
                            <div className="w-full flex justify-between text-sm text-gray-600 mb-2">
                                <span>Hạng VIP:</span>
                                <span className={`font-semibold ${isVipActive() ? 'text-[#d97706]' : 'text-red-600'}`}>
                                    {getVipTierLabel()}
                                </span>
                            </div>

                            {/* VIP Expiry Info */}
                            <div className="w-full flex justify-between text-sm text-gray-600">
                                <span>VIP hết hạn:</span>
                                <span className={`font-semibold ${isVipActive() ? 'text-green-600' : 'text-red-600'}`}>
                                    {isVipActive() ? formatVipExpiry() : 'Không có'}
                                </span>
                            </div>

                            {!isVipActive() && (
                                <Button
                                    type="primary"
                                    icon={<CrownOutlined />}
                                    onClick={() => navigate('/vip-upgrade')}
                                    className="mt-4 w-full bg-[#d97706] hover:!bg-[#b45309] h-10 font-semibold"
                                >
                                    Nâng cấp tài khoản VIP
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Cột phải: Form Tabs */}
                    <div className="w-full md:w-2/3 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        {loadingData ? (
                            <div className="flex justify-center items-center h-64">
                                <Spin size="large" />
                            </div>
                        ) : (
                            <Tabs 
                                defaultActiveKey="1" 
                                items={[
                                    { key: '1', label: <span className="font-semibold px-4 text-base">Hồ sơ cá nhân</span>, children: ProfileTab },
                                    { key: '2', label: <span className="font-semibold px-4 text-base">Đổi mật khẩu</span>, children: PasswordTab },
                                ]} 
                            />
                        )}
                    </div>
                </div>
            </main>

            <PublicFooter />
        </div>
    );
};

export default ProfilePage;