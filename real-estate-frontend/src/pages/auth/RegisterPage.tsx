import PublicHeader from "@/components/layouts/PublicHeader";
import PublicFooter from "@/components/layouts/PublicFooter";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { message } from "antd";

// Import authApi (bạn hãy điều chỉnh lại đường dẫn cho khớp với cấu trúc thư mục thực tế)
import { authApi } from "@/api/auth"; 

import userIcon from "../../assets/user.png";
import addressIcon from "../../assets/location (1).png";
import lockIcon from "../../assets/unlock.png";
import mailIcon from "../../assets/email.png";
import phoneIcon from "../../assets/phone-call.png";

const buildingImg = "https://images.unsplash.com/photo-1722421492323-eaf9c401befe?q=80&w=802&auto=format&fit=crop";
const eyeOpen = "https://cdn-icons-png.flaticon.com/512/159/159604.png";
const eyeClose = "https://cdn-icons-png.flaticon.com/512/565/565655.png";

const RegisterPage = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: "",
    email: "",
    phone: "",
    address: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validate = () => {
    if (!formData.username.trim()) {
      message.error("Vui lòng nhập tên tài khoản");
      return false;
    }
    if (formData.password.length < 6) {
      message.error("Mật khẩu phải ít nhất 6 ký tự");
      return false;
    }
    if (!formData.email.includes("@")) {
      message.error("Email không hợp lệ");
      return false;
    }
    if (!/^[0-9]{9,11}$/.test(formData.phone)) {
      message.error("Số điện thoại không hợp lệ");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setLoading(true);

      await authApi.register({
        username: formData.username,
        password: formData.password,
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
      });

      message.success("Đã gửi OTP về email!");
      navigate("/otp", { state: formData });

    } catch (error: any) {
      message.error(error?.response?.data?.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
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

          <div className="w-full md:w-1/2 max-w-[520px] border border-[#8a8989] rounded-[10px] p-8 bg-white flex flex-col">
            <h1 className="text-[32px] font-bold text-center mb-2">Đăng Ký</h1>
            <p className="text-center text-[#636366] mb-6">Vui lòng tạo tài khoản của bạn để tiếp tục.</p>

            <div className="flex items-center mb-8">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-[#46a5f0] text-white rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                <span className="text-sm font-medium">Thông tin</span>
              </div>
              <div className="flex-1 border-t border-gray-300 mx-4"></div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-sm">2</div>
                <span className="text-sm text-gray-400">Xác nhận OTP</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              <div className="flex items-center border border-[#e0e0e0] rounded-[10px] px-4 h-12">
                <img src={userIcon} className="w-5 h-5 opacity-70" alt="icon" />
                <input name="username" placeholder="Tên tài khoản" value={formData.username} onChange={handleChange} className="flex-1 ml-3 outline-none" />
              </div>

              <div className="flex items-center border border-[#e0e0e0] rounded-[10px] px-4 h-12">
                <img src={lockIcon} className="w-5 h-5 opacity-70" alt="icon" />
                <input type={showPassword ? "text" : "password"} name="password" placeholder="Mật khẩu" value={formData.password} onChange={handleChange} className="flex-1 ml-3 outline-none" />
                <img src={showPassword ? eyeOpen : eyeClose} className="w-5 h-5 cursor-pointer" onClick={() => setShowPassword(!showPassword)} alt="toggle password" />
              </div>

              <div className="flex items-center border border-[#e0e0e0] rounded-[10px] px-4 h-12">
                <img src={userIcon} className="w-5 h-5 opacity-70" alt="icon" />
                <input name="fullName" placeholder="Họ và tên" value={formData.fullName} onChange={handleChange} className="flex-1 ml-3 outline-none" />
              </div>

              <div className="flex items-center border border-[#e0e0e0] rounded-[10px] px-4 h-12">
                <img src={mailIcon} className="w-5 h-5 opacity-70" alt="icon" />
                <input name="email" placeholder="Email" value={formData.email} onChange={handleChange} className="flex-1 ml-3 outline-none" />
              </div>

              <div className="flex items-center border border-[#e0e0e0] rounded-[10px] px-4 h-12">
                <img src={phoneIcon} className="w-5 h-5 opacity-70" alt="icon" />
                <input name="phone" placeholder="Số điện thoại" value={formData.phone} onChange={handleChange} className="flex-1 ml-3 outline-none" />
              </div>

              <div className="flex items-center border border-[#e0e0e0] rounded-[10px] px-4 h-12">
                <img src={addressIcon} className="w-5 h-5 opacity-70" alt="icon" />
                <input name="address" placeholder="Địa chỉ" value={formData.address} onChange={handleChange} className="flex-1 ml-3 outline-none" />
              </div>

              <button type="submit" disabled={loading} className="mt-4 h-12 bg-[#254b86] text-white font-bold rounded-lg hover:bg-[#1e3d6b]">
                {loading ? "Đang xử lý..." : "Đăng Ký"}
              </button>
            </form>

            <p className="text-center text-[#636366] mt-6">
              Bạn đã có tài khoản?{" "}
              <Link to="/login" className="text-[#254b86] font-bold underline">
                Đăng Nhập Ngay
              </Link>
            </p>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
};

export default RegisterPage;