import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { formatCurrency } from '@/utils/format';
// ===== TYPES =====
interface PostImage {
  id?: number;
  url: string;
  position: number;
}

interface User {
  id: number;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  role?: string;
}

interface Post {
  id: number;
  title: string;
  city: string;
  district: string;
  ward: string;
  address: string;
  contactPhone?: string;
  contactLink?: string;
  description: string;
  price: number;
  area: number;
  direction?: string;
  propertyType?: string;
  postedAt?: string;
  isVip?: boolean;
  user?: User;
  images?: PostImage[];
}

const API = "http://localhost:5000/api";

// ===== HELPERS =====
const getThumbnail = (images?: PostImage[]) => {
  if (!images?.length) return "https://placehold.co/800x500?text=No+Image";
  return [...images].sort((a, b) => a.position - b.position)[0].url;
};


const maskPhone = (phone?: string, show = false) => {
  if (!phone) return "Đang cập nhật";
  if (show) return phone;
  const half = Math.ceil(phone.length / 2);
  return phone.slice(0, half) + "*".repeat(phone.length - half);
};

const getDisplayName = (fullName?: string) => {
  if (!fullName) return "Người dùng";
  if (fullName.trim() === "System Admin") return "Ban quản trị Black's City";
  return fullName;
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

// ===== LIGHTBOX =====
interface LightboxProps {
  images: string[];
  startIndex: number;
  title: string;
  onClose: () => void;
}

const Lightbox: React.FC<LightboxProps> = ({ images, startIndex, title, onClose }) => {
  const [current, setCurrent] = useState(startIndex);
  const prev = useCallback(() => setCurrent(c => (c - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setCurrent(c => (c + 1) % images.length), [images.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose, prev, next]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: "rgba(0,0,0,0.93)" }}
      onClick={onClose}
    >
      {/* Header */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={e => e.stopPropagation()}
      >
        <span className="text-white text-[14px] font-medium line-clamp-1 max-w-[70%] opacity-80">{title}</span>
        <div className="flex items-center gap-4">
          <span className="text-white text-[14px] font-semibold opacity-70">{current + 1} / {images.length}</span>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main image */}
      <div
        className="flex items-center justify-center w-full px-16"
        style={{ height: "calc(100vh - 140px)" }}
        onClick={e => e.stopPropagation()}
      >
        <img
          src={images[current]}
          alt={`${title} ${current + 1}`}
          className="max-w-full max-h-full object-contain rounded-lg select-none"
          style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}
        />
      </div>

      {/* Prev / Next */}
      {images.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); prev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full text-white hover:scale-110 transition-all"
            style={{ background: "rgba(255,255,255,0.18)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button
            onClick={e => { e.stopPropagation(); next(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full text-white hover:scale-110 transition-all"
            style={{ background: "rgba(255,255,255,0.18)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 px-6 py-3 overflow-x-auto"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={e => e.stopPropagation()}
        >
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="flex-shrink-0 rounded overflow-hidden transition-all duration-200"
              style={{
                width: 56, height: 40,
                outline: i === current ? "2.5px solid #f97316" : "2px solid transparent",
                opacity: i === current ? 1 : 0.55,
              }}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ===== GALLERY =====
interface GalleryProps {
  images: string[];
  title: string;
}

const Gallery: React.FC<GalleryProps> = ({ images, title }) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  // No images
  if (images.length === 0) {
    return (
      <div className="w-full h-[420px] bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex flex-col items-center justify-center gap-3 mb-6">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
        </svg>
        <span className="text-slate-400 text-sm">Chưa có hình ảnh</span>
      </div>
    );
  }

  // 1 image
  if (images.length === 1) {
    return (
      <>
        <div
          className="w-full mb-6 rounded-2xl overflow-hidden cursor-pointer"
          style={{ height: 460 }}
          onClick={() => openLightbox(0)}
        >
          <img src={images[0]} alt={title} className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-500" />
        </div>
        {lightboxIndex !== null && <Lightbox images={images} startIndex={lightboxIndex} title={title} onClose={closeLightbox} />}
      </>
    );
  }

  // 2 images: side by side
  if (images.length === 2) {
    return (
      <>
        <div className="mb-6">
          <div className="flex gap-2 rounded-2xl overflow-hidden" style={{ height: 460 }}>
            {images.map((src, i) => (
              <div key={i} className="flex-1 overflow-hidden cursor-pointer group relative" onClick={() => openLightbox(i)}>
                <img src={src} alt={`${title} ${i + 1}`} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-2">
            <button onClick={() => openLightbox(0)} className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-300 text-[13px] font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
              Xem tất cả
            </button>
          </div>
        </div>
        {lightboxIndex !== null && <Lightbox images={images} startIndex={lightboxIndex} title={title} onClose={closeLightbox} />}
      </>
    );
  }

  // 3 images: 1 big left (60%) + 2 stacked right
  if (images.length === 3) {
    return (
      <>
        <div className="mb-6">
          <div className="flex gap-2 rounded-2xl overflow-hidden" style={{ height: 460 }}>
            <div className="flex-shrink-0 overflow-hidden cursor-pointer group relative" style={{ width: "60%" }} onClick={() => openLightbox(0)}>
              <img src={images[0]} alt={title} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
            </div>
            <div className="flex-1 flex flex-col gap-2">
              {[1, 2].map(idx => (
                <div key={idx} className="flex-1 overflow-hidden cursor-pointer group relative" onClick={() => openLightbox(idx)}>
                  <img src={images[idx]} alt={`${title} ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300 pointer-events-none" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end mt-2">
            <button onClick={() => openLightbox(0)} className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-300 text-[13px] font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
              Xem tất cả 3 ảnh
            </button>
          </div>
        </div>
        {lightboxIndex !== null && <Lightbox images={images} startIndex={lightboxIndex} title={title} onClose={closeLightbox} />}
      </>
    );
  }

  // 4+ images: 1 big left (55%) + up to 4 thumbnails in 2x2 grid right
  const thumbCount = Math.min(images.length - 1, 4);
  const thumbIndices = Array.from({ length: thumbCount }, (_, i) => i + 1);
  const extraCount = images.length - 5;

  return (
    <>
      <div className="mb-6">
        <div className="flex gap-2 rounded-2xl overflow-hidden" style={{ height: 460 }}>
          {/* Big main image */}
          <div className="flex-shrink-0 overflow-hidden cursor-pointer group relative" style={{ width: "55%" }} onClick={() => openLightbox(0)}>
            <img src={images[0]} alt={title} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
          </div>
          {/* Thumbnails */}
          <div className={`flex-1 grid gap-2 ${thumbCount <= 2 ? "grid-rows-2" : "grid-rows-2 grid-cols-2"}`}>
            {thumbIndices.map((imgIdx, gridPos) => {
              const isLastThumb = gridPos === thumbIndices.length - 1 && extraCount > 0;
              return (
                <div key={imgIdx} className="relative overflow-hidden cursor-pointer group" onClick={() => openLightbox(imgIdx)}>
                  <img src={images[imgIdx]} alt={`${title} ${imgIdx + 1}`} className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300 pointer-events-none" />
                  {isLastThumb && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ background: "rgba(0,0,0,0.52)" }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" fill="white" /><polyline points="21 15 16 10 5 21" /></svg>
                      <span className="text-white text-[17px] font-bold leading-none">+{extraCount + 1}</span>
                      <span className="text-white/80 text-[11px] font-medium">xem thêm</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end mt-2">
          <button onClick={() => openLightbox(0)} className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-300 text-[13px] font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            Xem tất cả {images.length} ảnh
          </button>
        </div>
      </div>
      {lightboxIndex !== null && <Lightbox images={images} startIndex={lightboxIndex} title={title} onClose={closeLightbox} />}
    </>
  );
};


const IconArea = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
  </svg>
);

const IconDirection = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
  </svg>
);

const IconCalendar = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const IconHome = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
);

const IconPhone = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);


const IconPin = () => (
  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
  </svg>
);

const IconFacebook = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const IconZalo = () => (
  <svg className="w-4 h-4" viewBox="0 0 48 48" fill="none">
    <rect width="48" height="48" rx="10" fill="#0068ff" />
    <text x="7" y="33" fontSize="20" fontWeight="bold" fill="white" fontFamily="Arial">Zalo</text>
  </svg>
);

// ===== COMPONENT =====
const NewsDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [post, setPost] = useState<Post | null>(null);
  const [list, setList] = useState<Post[]>([]);
  const [showPhone, setShowPhone] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // ===== FETCH =====
  const fetchData = async () => {
    try {
      const [detailRes, listRes] = await Promise.all([
        axios.get(`${API}/posts/${id}`),
        axios.get(`${API}/posts/approved?page=1&limit=9`),
      ]);
      setPost(detailRes.data);
      setList(listRes.data.data || []);
      window.scrollTo(0, 0);
    } catch (err: any) {
      let errorMessage = "Có lỗi xảy ra, vui lòng thử lại!";
      if (err.response) {
        errorMessage = err.response.data?.message || `Lỗi server: ${err.response.status}`;
      } else if (err.request) {
        errorMessage = "Không thể kết nối đến server!";
      } else {
        errorMessage = err.message;
      }
      console.error("Chi tiết lỗi:", err);
      alert(errorMessage);
    }
  };

  useEffect(() => {
    setShowPhone(false);
    fetchData();
  }, [id]);

  // ===== SCROLL-BASED STICKY SIDEBAR =====
  useEffect(() => {
    if (!post) return;

    let gridTopAbs = 0;

    const calcGridTop = () => {
      if (gridRef.current) {
        gridTopAbs =
          gridRef.current.getBoundingClientRect().top + window.scrollY;
      }
    };

    const handleScroll = () => {
      const sidebar = sidebarRef.current;
      const grid = gridRef.current;
      if (!sidebar || !grid) return;

      const TOP_OFFSET = 90;
      const scrollY = window.scrollY;
      const sidebarH = sidebar.offsetHeight;
      const gridH = grid.offsetHeight;

      let translateY = 0;
      if (scrollY + TOP_OFFSET > gridTopAbs) {
        translateY = scrollY + TOP_OFFSET - gridTopAbs;
        const maxTranslate = gridH - sidebarH - 24;
        if (maxTranslate > 0) translateY = Math.min(translateY, maxTranslate);
        else translateY = 0;
      }

      sidebar.style.transform = `translateY(${translateY}px)`;
    };

    const timer = setTimeout(() => {
      calcGridTop();
      handleScroll();
    }, 100);

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", calcGridTop);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", calcGridTop);
    };
  }, [post]);

  const imageUrls = useMemo(() => {
    if (!post?.images?.length) return [];
    return [...post.images]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map(img => img.url)
      .filter(Boolean);
  }, [post?.images]);

  const related = useMemo(
    () => list.filter((p) => p.id !== Number(id)),
    [list, id]
  );

  const userPosts = useMemo(() => {
    if (!post?.user?.id) return [];
    return list.filter(
      (p) => p.user?.id === post.user?.id && p.id !== post.id
    );
  }, [list, post]);

  if (!post)
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-400">
        <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Đang tải dữ liệu...
      </div>
    );

  const isAdmin = post.user?.fullName === "System Admin";
  const displayPhone = post.contactPhone || post.user?.phone;
  const displayName = getDisplayName(post.user?.fullName);

  const postTypeLabel = (() => {

    const map: Record<string, string> = {
      SELL_HOUSE: 'Bán nhà', SELL_LAND: 'Bán đất', RENT_HOUSE: 'Cho thuê nhà',
      RENT_LAND: 'Cho thuê đất', NEED_BUY: 'Cần mua', NEED_RENT: 'Cần thuê',
      NEWS: 'Tin tức', PROMOTION: 'Khuyến mãi',
    };
    return map[(post as any).postType || (post as any).type || ''] || 'Bài viết';
  })();

  return (
    <div className="min-h-screen" style={{ background: '#f0f2f5' }}>

      {/* ── BREADCRUMB ── */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6">
          <nav className="flex items-center gap-1.5 text-xs text-gray-500 flex-wrap">
            <button onClick={() => navigate('/')} className="hover:text-[#254b86] transition font-medium">Trang chủ</button>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            <button onClick={() => navigate('/posts')} className="hover:text-[#254b86] transition font-medium">Bài viết</button>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            <span className="truncate font-semibold text-gray-800 max-w-[240px]">{post.title}</span>
          </nav>
        </div>
      </div>

      {/* ── ARTICLE ── */}
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <article>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {post.isVip && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-sm"
                style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                VIP
              </span>
            )}
            <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: '#eff4ff', color: '#254b86' }}>
              {postTypeLabel}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-extrabold leading-tight text-gray-900 mb-4">
            {post.title}
          </h1>

          {/* Location */}
          {(post.district || post.city) && (
            <p className="flex items-center gap-1.5 text-gray-500 text-[14px] mb-5">
              <IconPin />
              {[post.address, post.ward, post.district, post.city].filter(Boolean).join(', ')}
            </p>
          )}

          {/* Author / meta bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-y border-gray-200 py-4 mb-8">
            <div className="flex items-center gap-3">
              {post.user?.avatarUrl ? (
                <img src={post.user.avatarUrl} alt={displayName}
                  className="w-11 h-11 rounded-full object-cover border-2 border-gray-100 shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-base font-bold shrink-0"
                  style={{ background: 'linear-gradient(135deg,#254b86,#0d9488)' }}>
                  {displayName.charAt(0)}
                </div>
              )}
              <div>
                <div className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                  {displayName}
                  {isAdmin && (
                    <svg className="w-4 h-4 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                  {post.postedAt && (
                    <span className="inline-flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      {formatDate(post.postedAt)}
                    </span>
                  )}
                  {post.area && (
                    <span className="inline-flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                      {post.area} m²
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowPhone(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold text-white transition-all hover:opacity-90"
                style={{ background: '#254b86' }}>
                <IconPhone />
                {showPhone ? displayPhone : maskPhone(displayPhone, false)}
              </button>
              <a href={post.contactLink || '#'} target={post.contactLink ? '_blank' : '_self'} rel="noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-[#1877f2] transition">
                <IconFacebook />
              </a>
              <a href={post.contactLink || '#'} target={post.contactLink ? '_blank' : '_self'} rel="noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-[#0068ff] transition">
                <IconZalo />
              </a>
            </div>
          </div>

          {/* ── GALLERY ── */}
          <Gallery images={imageUrls} title={post.title} />

          {/* ── STATS BAR ── */}
          {(post.area || post.direction || post.postedAt || post.propertyType) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-8 grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
              {([
                post.area ? { icon: <IconArea />, label: 'Diện tích', value: `${post.area} m²` } : null,
                post.direction ? { icon: <IconDirection />, label: 'Hướng', value: post.direction } : null,
                post.postedAt ? { icon: <IconCalendar />, label: 'Ngày đăng', value: formatDate(post.postedAt) } : null,
                post.propertyType ? { icon: <IconHome />, label: 'Loại hình', value: post.propertyType } : null,
              ] as const).filter(Boolean).map((item, i) => (
                <div key={i} className="flex flex-col items-center justify-center gap-1 px-4 py-4">
                  <div style={{ color: '#254b86' }}>{item!.icon}</div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{item!.label}</p>
                  <p className="text-sm font-bold text-gray-800">{item!.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── PRICE ── */}
          {!!post.price && (
            <div className="mb-8 flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Mức giá</p>
                <p className="text-[1.6rem] font-extrabold leading-none" style={{ color: '#254b86' }}>
                  {formatCurrency(post.price)}
                </p>
              </div>
            </div>
          )}

          {/* ── CONTENT ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 mb-8">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-1 h-6 rounded-full shrink-0" style={{ background: '#254b86' }} />
              <h2 className="font-bold text-gray-800 text-[15px]">Thông tin chi tiết</h2>
            </div>
            <div
              className="text-gray-700 leading-relaxed text-[15px] [&_ul]:space-y-2 [&_ul]:mt-3 [&_li]:flex [&_li]:items-start [&_li]:gap-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3"
              dangerouslySetInnerHTML={{
                __html: post.description
                  ? post.description
                    .replace(/<li>/g, `<li><span style="color:#254b86;font-size:18px;line-height:1.2;flex-shrink:0">●</span><span>`)
                    .replace(/<\/li>/g, '</span></li>')
                  : ''
              }}
            />
          </div>

          {/* ── MAP ── */}
          {(post.address || post.district || post.city) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-5 rounded-full shrink-0" style={{ background: '#254b86' }} />
                <h2 className="font-bold text-gray-800 text-[13px] uppercase tracking-wide">Vị trí thực tế</h2>
              </div>
              <div className="rounded-xl overflow-hidden bg-gray-100" style={{ height: 240 }}>
                <iframe
                  title="map" width="100%" height="100%" style={{ border: 0 }}
                  loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(`${post.address}, ${post.district}, ${post.city}`)}&output=embed`}
                />
              </div>
            </div>
          )}

        </article>

        {/* ── RELATED POSTS ── */}
        {related.length > 0 && (
          <section className="border-t border-gray-200 pt-10 mt-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Bài viết liên quan</h2>
              <button onClick={() => navigate('/posts')}
                className="text-sm font-semibold flex items-center gap-1 hover:opacity-80 transition"
                style={{ color: '#254b86' }}>
                Xem tất cả
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {related.slice(0, 3).map((r) => (
                <div key={r.id} onClick={() => navigate(`/posts/${r.id}`)}
                  className="group overflow-hidden rounded-2xl border border-gray-200 bg-white hover:shadow-md transition-shadow cursor-pointer">
                  <div className="relative aspect-video overflow-hidden">
                    <img src={getThumbnail(r.images)} alt={r.title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    {r.isVip && (
                      <span className="absolute top-2 left-2 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest shadow"
                        style={{ background: '#f97316' }}>VIP</span>
                    )}
                  </div>
                  <div className="p-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#254b86' }}>
                      {postTypeLabel}
                    </span>
                    <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-gray-900 group-hover:text-[#254b86] transition-colors">
                      {r.title}
                    </h3>
                    {r.postedAt && <p className="mt-1.5 text-[11px] text-gray-400">{formatDate(r.postedAt)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── USER'S OTHER POSTS ── */}
        {userPosts.length > 0 && (
          <div className="mt-10 rounded-2xl p-6 md:p-8" style={{ background: '#1a2744' }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#f97316' }}>
                  Tuyển chọn bởi chuyên gia
                </p>
                <h2 className="text-lg font-bold text-white">
                  Bài viết khác từ {isAdmin ? "Ban quản trị Black's City" : displayName}
                </h2>
              </div>
              <button onClick={() => navigate('/posts')}
                className="text-sm text-white/50 hover:text-white/90 flex items-center gap-1 shrink-0 ml-4 mt-1 transition">
                Xem tất cả
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {userPosts.slice(0, 3).map((p) => (
                <div key={p.id}
                  className="rounded-xl p-4 cursor-pointer transition group hover:bg-white/10"
                  style={{ background: 'rgba(255,255,255,0.07)' }}
                  onClick={() => navigate(`/posts/${p.id}`)}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="bg-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                      {postTypeLabel}
                    </span>
                    <span className="text-white/40 text-xs">{formatDate(p.postedAt)}</span>
                  </div>
                  <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2 group-hover:text-orange-300 transition mb-1.5">
                    {p.title}
                  </h3>
                  <p className="text-white/45 text-xs line-clamp-2 leading-relaxed">
                    {p.description?.replace(/<[^>]*>/g, '').slice(0, 80)}...
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default NewsDetailPage;


