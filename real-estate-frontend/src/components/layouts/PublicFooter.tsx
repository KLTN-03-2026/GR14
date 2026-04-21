import React from 'react';
import { Link } from 'react-router-dom';
import group from "../../assets/logo.png";
import gps from "../../assets/icons8-gps-16.png";
import phone from "../../assets/icons8-phone-16.png";
import email from "../../assets/icons8-mail-16.png";

/* ─── Inline social SVG icons ─── */
const IconFacebook = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
);
const IconYoutube = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" /></svg>
);
const IconInstagram = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
);

/* ─── Footer link columns (content is identical to current) ─── */
const exploreLinks = [
  { label: "Trang Chủ",    href: "/" },
  { label: "Về Chúng Tôi", href: "/about" },
  { label: "Phong Thủy",   href: "/fengshui" },
  { label: "Đăng Bài Viết", href: "/news" },
];

const navigationLinks = [
  { label: "Tin Tức",  href: "/posts" },
  { label: "Nhà Ở",   href: "/houses" },
  { label: "Đất Đai", href: "/lands" },
  { label: "Dịch Vụ", href: "/" },
];

const contactInfo = [
  { icon: gps,   text: '8386 Nguyễn Văn Linh, Thanh Khê, Đà Nẵng', align: 'items-start' },
  { icon: phone, text: '0987 654 456',       align: 'items-center' },
  { icon: email, text: 'blackcity@gmail.com', align: 'items-center' },
];

const bottomLinks = [
  { label: 'Chính sách bảo mật', href: '/' },
  { label: 'Điều khoản sử dụng', href: '/' },
  { label: 'Hỗ trợ',             href: '/contact' },
];

/* ─── FooterCol helper ─── */
const FooterCol: React.FC<{ title: string; links: typeof exploreLinks }> = ({ title, links }) => (
  <div className="flex flex-col gap-5">
    <h4 className="text-white text-sm font-semibold tracking-widest uppercase flex items-center gap-2">
      <span className="w-4 h-px bg-blue-500 inline-block" />
      {title}
    </h4>
    <nav className="flex flex-col gap-3">
      {links.map((link, i) => (
        <Link
          key={i}
          to={link.href}
          className="text-sm text-gray-300 hover:text-white transition-all duration-200 flex items-center gap-2 group"
        >
          <span className="w-0 h-px bg-blue-400 group-hover:w-3 transition-all duration-200 inline-block" />
          {link.label}
        </Link>
      ))}
    </nav>
  </div>
);

const PublicFooter: React.FC = () => (
  <footer className="relative w-full bg-[#080f1e] text-gray-300 overflow-hidden">

    {/* Top accent line */}
    <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-60" />

    {/* Background grid pattern */}
    <div
      className="absolute inset-0 opacity-[0.03] pointer-events-none"
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
          <Link to="/" className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
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
          </Link>

          <p className="text-sm leading-7 text-gray-300 border-l-2 border-blue-500/30 pl-4">
            Nền tảng bất động sản uy tín giúp bạn tìm kiếm, mua bán và đầu tư
            nhà đất một cách nhanh chóng, minh bạch và hiệu quả.
          </p>

          {/* Social icons */}
          <div className="flex gap-3">
            {[IconFacebook, IconYoutube, IconInstagram].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-300 transition-all duration-200 hover:scale-110"
                style={{ background: 'rgba(255,255,255,0.08)' }}
                aria-label="social"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,179,237,0.25)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = ''; }}
              >
                <Icon />
              </a>
            ))}
          </div>
        </div>

        {/* Col 2 — Explore */}
        <div className="md:col-span-2">
          <FooterCol title="Khám phá" links={exploreLinks} />
        </div>

        {/* Col 3 — Categories */}
        <div className="md:col-span-2">
          <FooterCol title="Danh mục" links={navigationLinks} />
        </div>

        {/* Col 4 — Contact */}
        <div className="md:col-span-4 flex flex-col gap-5">
          <h4 className="text-white text-sm font-semibold tracking-widest uppercase flex items-center gap-2">
            <span className="w-4 h-px bg-blue-500 inline-block" />
            Liên hệ
          </h4>
          <address className="flex flex-col gap-4 not-italic text-sm">
            {contactInfo.map(({ icon, text, align }, i) => (
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
          {bottomLinks.map((item, i) => (
            <Link key={i} to={item.href} className="hover:text-white transition-colors duration-200">
              {item.label}
            </Link>
          ))}
        </div>
      </div>

    </div>
  </footer>
);

export default PublicFooter;