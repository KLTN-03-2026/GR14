import React from 'react';
import group from "../../assets/logo.png";
import gps from "../../assets/icons8-gps-16.png";
import phone from "../../assets/icons8-phone-16.png";
import email from "../../assets/icons8-mail-16.png";

const PublicFooter: React.FC = () => {

  const exploreLinks = ["Trang Chủ", "Về Chúng Tôi", "Tin Tức", "Đăng Bài Viết"];
  const navigationLinks = ["Liên Hệ", "Nhà Đất", "Đất Đai", "Dịch Vụ"];

  return (
    <footer className="relative w-full bg-[#080f1e] text-gray-300 overflow-hidden">

      {/* Top accent line */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-60" />

      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(99,179,237,1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(99,179,237,1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Glow blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600 opacity-5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-cyan-500 opacity-5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-[1290px] mx-auto px-6 pt-16 pb-6">

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">

          {/* Col 1 — Brand */}
          <div className="md:col-span-4 flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 opacity-20 rounded-xl blur-md" />
                <img
                  className="relative w-[52px] h-[52px] object-contain brightness-110"
                  alt="logo"
                  src={group}
                />
              </div>
              <div>
                <h2 className="text-white text-xl font-bold tracking-wide" style={{ fontFamily: "'Sora', sans-serif" }}>
                  Black<span className="text-blue-400">'</span>S City
                </h2>
                <p className="text-xs text-blue-400/70 tracking-widest uppercase">Real Estate Platform</p>
              </div>
            </div>

            <p className="text-sm leading-7 text-gray-300 border-l-2 border-blue-500/30 pl-4">
              Nền tảng bất động sản uy tín giúp bạn tìm kiếm, mua bán và đầu tư
              nhà đất một cách nhanh chóng, minh bạch và hiệu quả.
            </p>
          </div>

          {/* Col 2 — Explore */}
          <div className="md:col-span-2 flex flex-col gap-5">
            <h4 className="text-white text-sm font-semibold tracking-widest uppercase flex items-center gap-2">
              <span className="w-4 h-px bg-blue-500 inline-block" />
              Khám phá
            </h4>
            <nav className="flex flex-col gap-3">
              {exploreLinks.map((link, i) => (
                <a
                  key={i}
                  href="#"
                  className="text-sm text-gray-300 hover:text-white transition-all duration-200 flex items-center gap-2 group"
                >
                  <span className="w-0 h-px bg-blue-400 group-hover:w-3 transition-all duration-200 inline-block" />
                  {link}
                </a>
              ))}
            </nav>
          </div>

          {/* Col 3 — Categories */}
          <div className="md:col-span-2 flex flex-col gap-5">
            <h4 className="text-white text-sm font-semibold tracking-widest uppercase flex items-center gap-2">
              <span className="w-4 h-px bg-blue-500 inline-block" />
              Danh mục
            </h4>
            <nav className="flex flex-col gap-3">
              {navigationLinks.map((link, i) => (
                <a
                  key={i}
                  href="#"
                  className="text-sm text-gray-300 hover:text-white transition-all duration-200 flex items-center gap-2 group"
                >
                  <span className="w-0 h-px bg-blue-400 group-hover:w-3 transition-all duration-200 inline-block" />
                  {link}
                </a>
              ))}
            </nav>
          </div>

          {/* Col 4 — Contact */}
          <div className="md:col-span-4 flex flex-col gap-5">
            <h4 className="text-white text-sm font-semibold tracking-widest uppercase flex items-center gap-2">
              <span className="w-4 h-px bg-blue-500 inline-block" />
              Liên hệ
            </h4>
            <address className="flex flex-col gap-4 not-italic text-sm">
              {[
                { icon: gps, text: '8386 Nguyễn Văn Linh, Thanh Khê, Đà Nẵng', align: 'items-start' },
                { icon: phone, text: '0987 654 456', align: 'items-center' },
                { icon: email, text: 'blackcity@gmail.com', align: 'items-center' },
              ].map(({ icon, text, align }, i) => (
                <div key={i} className={`flex ${align} gap-3 group cursor-pointer`}>
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/20 transition-colors duration-200">
                    <img src={icon} className="w-4 h-4 opacity-90" alt="" />
                  </div>
                  <span className="text-gray-200 group-hover:text-white transition-colors duration-200 leading-5">{text}</span>
                </div>
              ))}
            </address>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <p>© 2026 <span className="text-gray-400">Black'S City</span>. All rights reserved.</p>
          <div className="flex gap-5">
            {['Chính sách bảo mật', 'Điều khoản sử dụng', 'Hỗ trợ'].map((item, i) => (
              <a key={i} href="#" className="hover:text-white transition-colors duration-200">{item}</a>
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
};

export default PublicFooter;