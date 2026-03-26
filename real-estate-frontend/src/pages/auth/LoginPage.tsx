import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { App as AntdApp } from 'antd';
import { authApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import PublicHeader from '@/components/layouts/PublicHeader';
import PublicFooter from '@/components/layouts/PublicFooter';
import { GoogleLogin } from '@react-oauth/google';
import gg from '@/assets/gg.png';


const buildingImg = "https://images.unsplash.com/photo-1722421492323-eaf9c401befe?q=80&w=802&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";
const accountMale = "https://cdn-icons-png.flaticon.com/512/1077/1077114.png";
const lockIcon = "https://cdn-icons-png.flaticon.com/512/3064/3064155.png";
const eyeOpen = "https://cdn-icons-png.flaticon.com/512/159/159604.png";
const eyeClose = "https://cdn-icons-png.flaticon.com/512/565/565655.png";

const LoginPage: React.FC = () => {
  const { message: messageApi } = AntdApp.useApp();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const handleRedirect = (user: any, fromPath?: string) => {
    if (fromPath) {
      navigate(fromPath, { replace: true });
    } else {
      const isAdmin = user?.roles?.includes('ADMIN') || false;
      navigate(isAdmin ? '/admin' : '/', { replace: true });
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login({ username, password });
      const { user, accessToken, refreshToken } = res.data;
      setAuth(user, accessToken, refreshToken);
      messageApi.success('Đăng nhập thành công!');
      handleRedirect(user, from);
    } catch (error: any) {
      messageApi.error(error.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };


  const handleGoogleSuccess = async (credentialResponse: any) => {
    setLoading(true);
    try {
      const idToken = credentialResponse.credential;
      if (!idToken) throw new Error("Không nhận được token");

      const res = await authApi.googleLogin(idToken);
      const { user, accessToken, refreshToken } = res.data;

      setAuth(user, accessToken, refreshToken);
      messageApi.success('Đăng nhập Google thành công!');
      handleRedirect(user, from);
    } catch (error: any) {
      console.error('Google Login Error:', error);
      messageApi.error(error?.response?.data?.message || 'Đăng nhập Google thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <PublicHeader />
      <main className="flex-1 flex items-center justify-center py-16">
        <div className="w-full max-w-[1100px] flex items-stretch justify-center gap-10 px-4">
          {/* IMAGE */}
          <div className="hidden md:block w-1/2 min-h-[620px] rounded-[10px] overflow-hidden shadow-lg border border-solid border-[#e0e0e0]">
            <img className="w-full h-full object-cover" alt="Building" src={buildingImg} />
          </div>

          {/* FORM */}
          <div className="w-full md:w-1/2 max-w-[520px] flex flex-col border border-solid border-[#8a8989] rounded-[10px] p-8 bg-white">
            <h1 className="text-[40px] font-bold text-[#222] mb-2 text-center">Đăng Nhập</h1>
            <p className="text-[#636366] mb-8 text-center">Vui lòng nhập tài khoản của bạn.</p>

            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
              {/* USERNAME */}
              <div className="relative w-full h-12 bg-white rounded-[10px] border border-solid border-[#e0e0e0] flex items-center px-4">
                <img className="w-6 h-6 opacity-70" alt="user" src={accountMale} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Tên tài khoản"
                  className="flex-1 ml-3 bg-transparent border-none outline-none text-gray-700"
                  required
                />
              </div>

              {/* PASSWORD */}
              <div>
                <div className="relative w-full h-12 bg-white rounded-[10px] border border-solid border-[#e0e0e0] flex items-center px-4">
                  <img className="w-6 h-6 opacity-70" alt="lock" src={lockIcon} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mật khẩu"
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
                <div className="flex justify-end mt-2">
                  <Link to="/forgot-password" className="text-sm text-[#254b86] hover:underline">
                    Quên Mật Khẩu ?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full h-[51px] flex justify-center items-center bg-[#254b86] text-white rounded-[10px] font-bold text-base hover:bg-[#1e3d6b] transition-colors mt-4 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Đang xử lý...' : 'Đăng Nhập'}
              </button>
            </form>

            <div className="relative flex items-center w-full my-8">
              <div className="flex-grow border-t border-[#8a8989]"></div>
              <span className="mx-4 text-[#8a8989]">Hoặc</span>
              <div className="flex-grow border-t border-[#8a8989]"></div>
            </div>

            {/*NÚT GOOGLE  */}
            <div className="relative w-full">

              <button
                type="button"
                disabled={loading}
                className="w-full h-[51px] flex items-center justify-center gap-3 bg-white border border-[#254b86] rounded-[10px] hover:bg-gray-50 transition-all font-bold text-base"
              >
                <span className="text-[#254b86]">Đăng Nhập Với Google</span>
                <img
                  src={gg}
                  alt="Google"
                  className="w-6 h-6"
                />
              </button>

              {/* Button thật của Google trùm lên (ẩn hoàn toàn) */}
              <div className="absolute inset-0 opacity-0 pointer-events-auto">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => messageApi.error('Đăng nhập Google thất bại')}
                  useOneTap={false}
                />
              </div>
            </div>

            <p className="mt-8 text-[#636366] text-center">
              Bạn chưa có tài khoản?{' '}
              <Link to="/register" className="text-[#254b86] font-bold underline hover:text-[#1e3d6b]">
                Đăng Ký Ngay
              </Link>
            </p>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
};

export default LoginPage;