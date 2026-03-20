import React from 'react';
import group from "../../assets/logo.png";
import gps from "../../assets/gps.png"; 
import phone from "../../assets/phone.png"; 
import email from "../../assets/mail.png"; 

const PublicFooter: React.FC = () => {
  const exploreLinks = ["Trang Chủ", "Về Chúng Tôi", "Tin Tức", "Đăng Bài Viết"];
  const navigationLinks = ["Liên Hệ", "Nhà Đất", "Đất Đai", "Dịch Vụ"];

  return (
    <footer className="w-full bg-[#0f172a] text-gray-300 pt-16 pb-6 px-4">
      <div className="max-w-[1290px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">

        {/* Cột 1 */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <img className="w-[120px] h-auto brightness-200 contrast-150 bg=white" alt="logo" src={group} />
            <h2 className="text-white text-xl font-bold">
              Black'S City
            </h2>
          </div>

          <p className="text-sm leading-6 text-gray-400">
            Nền tảng bất động sản uy tín giúp bạn tìm kiếm, mua bán và đầu tư 
            nhà đất một cách nhanh chóng, minh bạch và hiệu quả.
          </p>

          <address className="flex flex-col gap-3 not-italic text-sm">

            <div className="flex items-start gap-3">
              <img src={gps} className="w-5 h-5 mt-1" />
              <p>8386 Nguyễn Văn Linh, Thanh Khê, Đà Nẵng</p>
            </div>

            <div className="flex items-center gap-3">
              <img src={phone} className="w-5 h-5" />
              <p>0987 654 456</p>
            </div>

            <div className="flex items-center gap-3">
              <img src={email} className="w-5 h-5" />
              <p>blackcity@gmail.com</p>
            </div>

          </address>
        </div>

        {/* Cột 2 */}
        <div className="flex flex-col gap-5">
          <h4 className="text-white text-lg font-semibold">Khám phá</h4>
          <nav className="flex flex-col gap-3 text-sm">
            {exploreLinks.map((link, index) => (
              <a 
                key={index} 
                href="#" 
                className="hover:text-blue-400 transition"
              >
                {link}
              </a>
            ))}
          </nav>
        </div>

        {/* Cột 3 */}
        <div className="flex flex-col gap-5">
          <h4 className="text-white text-lg font-semibold">Danh mục</h4>
          <nav className="flex flex-col gap-3 text-sm">
            {navigationLinks.map((link, index) => (
              <a 
                key={index} 
                href="#" 
                className="hover:text-blue-400 transition"
              >
                {link}
              </a>
            ))}
          </nav>
        </div>

        {/* Cột 4 */}
        <div className="flex flex-col gap-5">
          <h4 className="text-white text-lg font-semibold">Nhận tin mới</h4>
          <p className="text-sm text-gray-400">
            Đăng ký để nhận thông tin bất động sản mới nhất mỗi ngày.
          </p>

          <div className="flex w-full mt-2">
            <input
              type="email"
              placeholder="Nhập email..."
              className="flex-1 h-11 px-4 bg-white text-black rounded-l-lg outline-none"
            />
            <button className="h-11 px-5 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition">
              Gửi
            </button>
          </div>

          {/* Social */}
          <div className="flex gap-4 mt-3 text-sm">
            <span className="cursor-pointer hover:text-blue-400">Facebook</span>
            <span className="cursor-pointer hover:text-blue-400">Zalo</span>
            <span className="cursor-pointer hover:text-blue-400">Youtube</span>
          </div>
        </div>

      </div>

      {/* Bottom */}
      <div className="border-t border-gray-700 mt-10 pt-5 text-center text-sm text-gray-400">
        © 2026 Black'S City. All rights reserved.
      </div>
    </footer>
  );
};

export default PublicFooter;