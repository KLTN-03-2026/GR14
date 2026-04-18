import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '@/api';

// Import Layout
import PublicHeader from "@/components/layouts/PublicHeader";
import PublicFooter from "@/components/layouts/PublicFooter";

// Assets
const buildingImg = "https://images.unsplash.com/photo-1722421492323-eaf9c401befe?q=80&w=802&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";
const mailIcon = "https://cdn-icons-png.flaticon.com/512/732/732200.png";
const lockIcon = "https://cdn-icons-png.flaticon.com/512/3064/3064155.png";
const eyeOpen = "https://cdn-icons-png.flaticon.com/512/159/159604.png";
const eyeClose = "https://cdn-icons-png.flaticon.com/512/565/565655.png";

const ForgotPasswordPage: React.FC = () => {
    const navigate = useNavigate();
    
    // States
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<1 | 2>(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // BƯỚC 1: GỬI OTP
    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.includes('@')) {
            return toast.error('Vui lòng nhập email hợp lệ');
        }

        setLoading(true);
        try {
            await authApi.forgotPassword({ email });
            toast.success('Mã OTP đã được gửi đến email của bạn');
            setStep(2); // Chuyển sang bước 2
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Không tìm thấy email này trong hệ thống');
        } finally {
            setLoading(false);
        }
    };

    // BƯỚC 2: ĐẶT LẠI MẬT KHẨU
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            return toast.error('Mật khẩu phải có ít nhất 6 ký tự');
        }

        setLoading(true);
        try {
            await authApi.resetPassword({ email, otp, newPassword });
            toast.success('Đặt lại mật khẩu thành công!');
            navigate('/login');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Mã OTP không đúng hoặc đã hết hạn');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-white">
            {/* Header đã có sẵn */}
            <PublicHeader />

            <main className="flex-1 flex items-center justify-center py-16">
                <div className="w-full max-w-[1100px] flex items-stretch justify-center gap-10 px-4">
                    
                    {/* Ảnh bên trái */}
                    <div className="hidden md:block w-1/2 min-h-[500px] rounded-[10px] overflow-hidden shadow-lg border border-solid border-[#e0e0e0]">
                        <img className="w-full h-full object-cover" alt="Building" src={buildingImg} />
                    </div>

                    {/* Form bên phải */}
                    <div className="w-full md:w-1/2 max-w-[520px] flex flex-col justify-center border border-solid border-[#8a8989] rounded-[10px] p-8 bg-white">
                        <h1 className="text-[36px] font-bold text-[#222] mb-2 text-center">
                            Quên Mật Khẩu
                        </h1>
                        <p className="text-[#636366] mb-8 text-center">
                            {step === 1 
                                ? "Vui lòng nhập email đã đăng ký để nhận mã OTP." 
                                : `Mã OTP đã được gửi tới ${email}.`}
                        </p>

                        {/* --- FORM BƯỚC 1: NHẬP EMAIL --- */}
                        {step === 1 && (
                            <form onSubmit={handleSendOtp} className="w-full flex flex-col gap-4">
                                <div className="relative w-full h-12 bg-white rounded-[10px] border border-solid border-[#e0e0e0] flex items-center px-4 focus-within:border-[#254b86] transition-colors">
                                    <img className="w-5 h-5 opacity-70" alt="mail" src={mailIcon} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Nhập địa chỉ Email"
                                        className="flex-1 ml-3 bg-transparent border-none outline-none text-gray-700"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full h-[51px] flex justify-center items-center bg-[#254b86] text-white rounded-[10px] font-bold text-base hover:bg-[#1e3d6b] transition-colors mt-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {loading ? 'Đang gửi...' : 'Gửi Mã Xác Nhận'}
                                </button>
                            </form>
                        )}

                        {/* --- FORM BƯỚC 2: NHẬP OTP & PASS MỚI --- */}
                        {step === 2 && (
                            <form onSubmit={handleResetPassword} className="w-full flex flex-col gap-4">
                                {/* Input OTP */}
                                <div className="relative w-full h-12 bg-white rounded-[10px] border border-solid border-[#e0e0e0] flex items-center px-4 focus-within:border-[#254b86] transition-colors">
                                    <span className="font-bold text-[#254b86]">OTP</span>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        placeholder="Nhập mã OTP (6 số)"
                                        className="flex-1 ml-4 bg-transparent border-none outline-none text-gray-700 tracking-widest"
                                        maxLength={6}
                                        required
                                    />
                                </div>

                                {/* Input Mật khẩu mới */}
                                <div className="relative w-full h-12 bg-white rounded-[10px] border border-solid border-[#e0e0e0] flex items-center px-4 focus-within:border-[#254b86] transition-colors">
                                    <img className="w-5 h-5 opacity-70" alt="lock" src={lockIcon} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Nhập mật khẩu mới"
                                        className="flex-1 ml-3 bg-transparent border-none outline-none text-gray-700"
                                        required
                                    />
                                    <img
                                        src={showPassword ? eyeOpen : eyeClose}
                                        alt="toggle password"
                                        className="w-5 h-5 cursor-pointer opacity-70 hover:opacity-100"
                                        onClick={() => setShowPassword(!showPassword)}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full h-[51px] flex justify-center items-center bg-[#254b86] text-white rounded-[10px] font-bold text-base hover:bg-[#1e3d6b] transition-colors mt-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {loading ? 'Đang xử lý...' : 'Đặt Lại Mật Khẩu'}
                                </button>
                            </form>
                        )}

                        {/* Nút Quay lại */}
                        <div className="mt-8 text-center">
                            <Link to="/login" className="text-[#636366] hover:text-[#254b86] font-medium transition-colors">
                                ← Quay lại Đăng Nhập
                            </Link>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer đã có sẵn */}
            <PublicFooter />
        </div>
    );
};

export default ForgotPasswordPage;