import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { message } from "antd";
import PublicHeader from "@/components/layouts/PublicHeader";
import PublicFooter from "@/components/layouts/PublicFooter";


import { authApi } from "@/api/auth"; 

const buildingImg = "https://images.unsplash.com/photo-1722421492323-eaf9c401befe?q=80&w=802&auto=format&fit=crop";

const ConfirmOTP = () => {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const location = useLocation();
  const navigate = useNavigate();

  const formData = location.state;

  useEffect(() => {
    if (!formData) {
      message.error("Vui lòng đăng ký lại");
      navigate("/register");
    }
  }, [formData, navigate]);

  useEffect(() => {
    if (countdown === 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) {
      message.error("Vui lòng nhập mã OTP");
      return;
    }

    try {
      setLoading(true);

      await authApi.confirmRegister({
        ...formData,
        otp,
      });

      message.success("Đăng ký thành công!");
      navigate("/login");
    } catch (error: any) {
      message.error(error?.response?.data?.message || "OTP không chính xác");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await authApi.register(formData);
      message.success("Đã gửi lại OTP");
      setCountdown(60);
    } catch {
      message.error("Không thể gửi lại OTP");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <PublicHeader />
      <main className="flex-1 flex items-center justify-center py-16 bg-gray-50">
        <div className="w-full max-w-[1100px] flex items-stretch justify-center gap-10 px-4">
          

          <div className="hidden md:block w-1/2 rounded-[10px] overflow-hidden shadow-lg border border-[#e0e0e0]">
            <img src={buildingImg} className="w-full h-full object-cover" alt="Building" />
          </div>


          <div className="w-full md:w-1/2 max-w-[520px] border border-[#8a8989] rounded-[10px] p-8 bg-white flex flex-col justify-center">
            
            <h1 className="text-[32px] font-bold text-center mb-2">Xác Nhận OTP</h1>
            <p className="text-center text-[#636366] mb-8">Vui lòng nhập mã OTP đã gửi về gmail của bạn.</p>
            <div className="flex items-center mb-8">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-[#46a5f0] text-white rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                <span className="text-sm font-semibold text-[#333]">Xác nhận OTP</span>
              </div>
              <div className="flex-1 border-t border-gray-300 mx-4"></div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-medium">3</div>
                <span className="text-sm text-gray-400">Đăng ký thành công</span>
              </div>
            </div>


            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="border border-[#e0e0e0] rounded-[10px] h-12 flex items-center px-4 overflow-hidden focus-within:border-[#46a5f0] transition-colors">
                <input
                  placeholder="Nhập mã OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full outline-none text-[15px]"
                />
              </div>

              <button 
                type="submit" 
                className="h-12 bg-[#254b86] text-white rounded-[10px] font-bold hover:bg-[#1e3d6b] transition-colors" 
                disabled={loading}
              >
                {loading ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </form>

            <div className="text-center mt-6 text-sm">
              {countdown > 0 ? (
                <span className="text-[#636366]">Gửi lại OTP sau {countdown}s</span>
              ) : (
                <button onClick={handleResend} className="text-[#254b86] font-bold hover:underline outline-none">
                  Gửi lại OTP
                </button>
              )}
            </div>

          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
};

export default ConfirmOTP;