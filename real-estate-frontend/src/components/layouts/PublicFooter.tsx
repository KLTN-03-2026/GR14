import React from 'react';
import group from "../../assets/logo.png";
import gps from "../../assets/gps.png"; 
import phone from "../../assets/phone.png"; 
import email from "../../assets/mail.png"; 


const PublicFooter: React.FC = () => {
  const exploreLinks = ["Trang Chủ", "Về Chúng Tôi", "Tin Tức", "Đăng Bài Viết"];
  const navigationLinks = ["Liên Hệ", "Nhà Đất", "Đất Đai", "Dịch Vụ"];

  return (
    <footer className="w-full bg-[#f2f2f2] py-16 px-4">
      <div className="max-w-[1290px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        
        {/* Cột 1: Thông tin công ty */}
        <div className="flex flex-col items-start gap-6">
          <div className="flex items-center gap-2">
            <img className="w-[45px] h-8" alt="Black'S City Logo" src={group} />
            <h2 className="font-black text-variable-collection-primary-800 text-[22px] leading-7">
              Black'S City
            </h2>
          </div>
              <address className="flex flex-col gap-4 not-italic font-p text-variable-collection-general-700">

                <div className="flex items-start gap-3">
                  <img src={gps} alt="address" className="w-5 h-5 mt-1" />
                  <p>8386 Nguyễn Văn Linh, Thanh Khê, Đà Nẵng</p>
                </div>

                <div className="flex items-center gap-3">
                  <img src={phone} alt="phone" className="w-5 h-5" />
                  <p>0987654456</p>
                </div>

                <div className="flex items-center gap-3">
                  <img src={email} alt="email" className="w-5 h-5" />
                  <p>blackcityl@gmail.com</p>
                </div>

              </address>

        </div>
        {/* Cột 2: Explore */}
        <div className="flex flex-col items-start gap-6">
          <h4 className="font-h-4 text-[22px] font-bold text-variable-collection-primary-800">Explore</h4>
          <nav className="flex flex-col gap-4">
            {exploreLinks.map((link, index) => (
              <a key={index} href="#" className="font-p text-variable-collection-general-700 hover:text-blue-600">
                {link}
              </a>
            ))}
          </nav>
        </div>

        {/* Cột 3: Links */}
        <div className="flex flex-col items-start gap-6">
          <h4 className="font-h-4 text-[22px] font-bold text-variable-collection-primary-800">Links</h4>
          <nav className="flex flex-col gap-4">
            {navigationLinks.map((link, index) => (
              <a key={index} href="#" className="font-p text-variable-collection-general-700 hover:text-blue-600">
                {link}
              </a>
            ))}
          </nav>
        </div>

        {/* Cột 4: Feedback & Newsletter */}
        <div className="flex flex-col items-start gap-6">
          <h4 className="font-h-4 text-[22px] font-bold text-variable-collection-primary-800">Feedback</h4>
          <p className="font-p text-variable-collection-general-700">
            Nếu bạn có bất cứ ý kiến gì vui lòng liên hệ với chúng tôi
          </p>
          <div className="flex w-full mt-2">
            <input
              type="email"
              placeholder="Email Của Bạn"
              className="flex-1 h-12 px-4 bg-white rounded-l-[10px] border border-solid border-variable-collection-general-300 font-p outline-none"
            />
            <button className="h-12 px-5 bg-variable-collection-primary-800 text-white font-a rounded-r-[10px] hover:bg-[#1e3d6b] transition-colors">
              Gửi
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default PublicFooter;