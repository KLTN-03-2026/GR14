import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import type { Post } from "@/types/post";

// ── Local slide images (bundled by Vite, safe for VPS deploy) ──
import imgBinhDuong from "@/assets/binh-duong-industrial-park-modern-city.jpg";
import imgVilla from "@/assets/luxury-vietnamese-villa-with-garden-pool-thao-dien.jpg";
import imgDaNang from "@/assets/da-nang-dragon-bridge-coastal-city.jpg";
import imgHanoi from "@/assets/hanoi-skyline-with-west-lake-modern-buildings.jpg";
import imgHCMC from "@/assets/cityscape-of-ho-chi-minh-city-skyline-at-dusk.jpg";


interface PostImage { url: string; position: number; }

const API_URL = "http://localhost:5000/api/posts/approved";

// ── Cố định 5 ảnh đẹp cho Hero Slider — luôn hiển thị bất kể bài viết có ảnh hay không ──
const HERO_SLIDE_IMAGES = [
  imgHCMC,      // TP. Hồ Chí Minh skyline
  imgVilla,     // Luxury villa with pool
  imgHanoi,     // Hà Nội skyline West Lake
  imgDaNang,    // Đà Nẵng Dragon Bridge
  imgBinhDuong, // Bình Dương modern city
];

const getThumbnail = (images?: PostImage[]) => {
  if (!images?.length) return "";
  return [...images].sort((a, b) => a.position - b.position)[0]?.url ?? "";
};

const formatDate = (raw?: string | null) => {
  if (!raw) return "";
  const d = new Date(raw);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatTime = (raw?: string | null) => {
  if (!raw) return "";
  return new Date(raw).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
};


const toPlainText = (html?: string) => {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
};


const POSTS_PER_PAGE = 9;

const CATEGORY_TABS = [
  { label: "Tất cả", value: "all" },
  { label: "Tin tức", value: "NEWS" },
  { label: "Bán nhà", value: "SELL_HOUSE" },
  { label: "Cho thuê", value: "RENT_HOUSE" },
  { label: "Bán đất", value: "SELL_LAND" },
  { label: "Cho thuê đất", value: "RENT_LAND" },
  { label: "Cần mua", value: "NEED_BUY" },
  { label: "Cần thuê", value: "NEED_RENT" },
  { label: "Khuyến mãi", value: "PROMOTION" },
];



const getPageNumbers = (current: number, total: number): (number | "...")[] => {
  if (total <= 1) return [1];
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total]);
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) set.add(i);
  const sorted = Array.from(set).sort((a, b) => a - b);
  const result: (number | "...")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("...");
    result.push(sorted[i]);
  }
  return result;
};


const Pagination = ({
  page, total, totalCount: _totalCount, perPage: _perPage, onChange,
}: {
  page: number; total: number; totalCount: number; perPage: number;
  onChange: (p: number) => void;
}) => {
  const [jump, setJump] = useState("");
  const pages = getPageNumbers(page, total);

  const doJump = () => {
    const v = parseInt(jump, 10);
    if (v >= 1 && v <= total) { onChange(v); setJump(""); }
  };

  return (
    <div className="flex justify-center py-8">
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm select-none">…</span>
          ) : (
            <button
              key={`pg-${p}`}
              onClick={() => onChange(p as number)}
              className="w-8 h-8 flex items-center justify-center rounded-full border text-[13px] font-medium transition"
              style={
                page === p
                  ? { background: "#254b86", borderColor: "#254b86", color: "#fff" }
                  : { background: "#fff", borderColor: "#e5e7eb", color: "#374151" }
              }
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onChange(Math.min(total, page + 1))}
          disabled={page === total}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Jump — hiện khi > 5 trang  ← GIỐNG HỆT FILE GỐC */}
        {total > 5 && (
          <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-gray-200">
            <span className="text-xs text-gray-400">Đến trang</span>
            <input
              type="number" min={1} max={total} value={jump}
              onChange={e => setJump(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doJump()}
              placeholder="—"
              className="w-12 h-8 text-center text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#254b86]/20 focus:border-[#254b86] transition"
            />
            <button onClick={doJump} className="px-3 h-8 text-xs border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-600 transition">
              Đi
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


const HeroSlider = ({
  posts,
  onNavigate,
}: {
  posts: Post[];
  onNavigate: (id: number) => void;
}) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (posts.length <= 1) return;
    const t = setInterval(() => setCurrent(p => (p + 1) % posts.length), 5000);
    return () => clearInterval(t);
  }, [posts.length]);

  if (!posts.length) return null;

  return (
    <div className="relative w-full overflow-hidden" style={{ height: 480 }}>
      {posts.map((post, i) => {
        const img = HERO_SLIDE_IMAGES[i % HERO_SLIDE_IMAGES.length];
        const time = formatTime(post.postedAt ?? post.createdAt);
        const date = formatDate(post.postedAt ?? post.createdAt);
        return (
          <div
            key={post.id}
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: i === current ? 1 : 0, zIndex: i === current ? 1 : 0 }}
          >
            <img src={img} alt={post.title} className="w-full h-full object-cover" />

            <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.05) 100%)" }} />

            <div className="absolute inset-0 flex items-center">
              <div
                className="max-w-[520px] px-10 py-9 ml-0"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderLeft: "none",
                  borderRadius: "0 24px 24px 0",
                  boxShadow: "6px 6px 40px rgba(0,0,0,0.18)",
                }}
              >
                {(time || date) && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/95 rounded-full px-3 py-1 w-fit mb-4"
                    style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)" }}
                  >
                    {time}{time && date && <span className="mx-1 opacity-60">·</span>}{date}
                  </span>
                )}

                <h1 className="font-bold text-white leading-tight mb-3 line-clamp-3" style={{ fontSize: "clamp(22px, 2.5vw, 32px)" }}>
                  {post.title}
                </h1>
                {(post as any).description && (
                  <p className="text-[13px] text-white/80 line-clamp-2 leading-relaxed mb-6">
                    {toPlainText((post as any).description)}
                  </p>
                )}
                <button
                  onClick={() => onNavigate(post.id)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold text-[#1a2e52] bg-white hover:bg-white/90 transition-all duration-200 shadow-sm"
                >
                  Đọc Full
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {posts.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {posts.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === current ? 24 : 8,
                height: 8,
                background: i === current ? "#fff" : "rgba(255,255,255,0.45)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ListCard = ({ post }: { post: Post }) => {
  const navigate = useNavigate();
  const img = getThumbnail(post.images as any);
  const date = formatDate(post.postedAt ?? post.createdAt);
  const time = formatTime(post.postedAt ?? post.createdAt);
  const cat = CATEGORY_TABS.find(c => c.value === (post.postType ?? (post as any).type ?? (post as any).postType ?? (post as any).post_type))?.label ?? "BÀI VIẾT";
  const isVip = !!post.isVip;
  const desc = toPlainText((post as any).description);

  if (isVip) {
    return (
      <article
        onClick={() => navigate(`/posts/${post.id}`)}
        className="group flex rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md"
        style={{
          background: "linear-gradient(135deg, #FFF0E0 0%, #FFF8F0 100%)",
          border: "1px solid #fdd5aa",
          boxShadow: "0 2px 8px rgba(249,115,22,0.07)",
        }}
      >

        <div className="shrink-0 p-3" style={{ width: 230 }}>
          <div className="relative w-full h-full overflow-hidden rounded-xl" style={{ minHeight: 160 }}>
            <img
              src={img}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <span
              className="absolute top-2.5 left-2.5 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest shadow"
              style={{ background: "#f97316" }}
            >
              VIP
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-2 py-5 px-5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {(time || date) && (
              <span className="text-[12px] font-semibold" style={{ color: "#c05000" }}>
                {time}
                {time && date && <span className="mx-1.5" style={{ color: "#f0b07a" }}>·</span>}
                {date}
              </span>
            )}
            {cat && (
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#ea6c00" }}>
                {cat}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-bold leading-snug line-clamp-2 transition-colors" style={{ fontSize: "18px", color: "#1a1a1a" }}>
            {post.title}
          </h3>

          {/* Description */}
          {desc && (
            <p className="text-[13px] line-clamp-2 leading-relaxed" style={{ color: "#7a4f2a" }}>
              {desc}
            </p>
          )}

          {/* CTA */}
          <div className="flex items-center gap-0.5 text-[12.5px] font-semibold mt-1" style={{ color: "#ea6c00" }}>
            Đọc Full
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
      </article>
    );
  }

  // Regular card — clean, editorial
  return (
    <article
      onClick={() => navigate(`/posts/${post.id}`)}
      className="group flex rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md"
      style={{
        background: "#ffffff",
        border: "1px solid #edf0f4",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Thumbnail flush */}
      <div className="relative shrink-0 overflow-hidden rounded-xl m-3" style={{ width: 200, minHeight: 150 }}>
        <img
          src={img}
          alt={post.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>

      {/* Content */}
      <div className="flex flex-col justify-center gap-2 py-5 px-4 flex-1 min-w-0">
        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          {(time || date) && (
            <span className="text-[12px] font-semibold" style={{ color: "#9ca3af" }}>
              {time}
              {time && date && <span className="mx-1.5 text-gray-300">·</span>}
              {date}
            </span>
          )}
          {cat && (
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: "#eff4ff", color: "#254b86" }}
            >
              {cat}
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          className="font-bold leading-snug line-clamp-2 group-hover:text-[#254b86] transition-colors"
          style={{ fontSize: "17px", color: "#111827" }}
        >
          {post.title}
        </h3>

        {/* Description */}
        {desc && (
          <p className="text-[13px] line-clamp-2 leading-relaxed" style={{ color: "#6b7280" }}>
            {desc}
          </p>
        )}

        {/* CTA */}
        <div className="flex items-center gap-0.5 text-[12.5px] font-semibold mt-1 transition-colors" style={{ color: "#254b86" }}>
          Đọc Full
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </article>
  );
};

// Sidebar: Bài Viết Nổi Bật — ranked list
const SidebarFeatured = ({ posts }: { posts: Post[] }) => {
  const navigate = useNavigate();

  const RANK_STYLE = [
    { bg: "#f97316", color: "#fff" },
    { bg: "#fb923c", color: "#fff" },
    { bg: "#fed7aa", color: "#c2410c" },
    { bg: "#f3f4f6", color: "#9ca3af" },
    { bg: "#f3f4f6", color: "#9ca3af" },
  ];

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid #f0f0f0" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "2px solid #f5f5f5" }}>
        <span className="w-1 h-6 rounded-full shrink-0" style={{ background: "#254b86" }} />
        <h3 className="font-bold text-[15px] text-gray-800">Bài Viết Nổi Bật</h3>
      </div>

      {/* List */}
      <div>
        {posts.map((p, i) => {
          const cat = CATEGORY_TABS.find(c => c.value === (p.postType ?? (p as any).type))?.label ?? "Bài viết";
          const rs = RANK_STYLE[i] ?? RANK_STYLE[4];
          return (
            <div
              key={p.id}
              onClick={() => navigate(`/posts/${p.id}`)}
              className="flex items-start gap-3 px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors group"
              style={{ borderBottom: "1px solid #f5f5f5" }}
            >
              {/* Rank number — bold colored text like image */}
              <span
                className="shrink-0 w-6 h-6 rounded-full text-[12px] font-black flex items-center justify-center mt-0.5 leading-none"
                style={{ background: rs.bg, color: rs.color }}
              >
                {i + 1}
              </span>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-800 group-hover:text-[#254b86] line-clamp-2 leading-snug transition-colors mb-1">
                  {p.title}
                </p>
                <span
                  className="inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm"
                  style={{ background: "#f3f4f6", color: "#9ca3af" }}
                >
                  {cat}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Sidebar: Bài Viết Mới Nhất — thumbnail overlay cards
const SidebarLatest = ({ posts }: { posts: Post[] }) => {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid #f0f0f0" }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5" style={{ borderBottom: "1px solid #f5f5f5" }}>
        <span className="w-[3px] h-5 rounded-full shrink-0 bg-[#254b86]" />
        <h3 className="font-bold text-[14px] text-gray-800">Bài Viết Mới Nhất</h3>
      </div>

      {/* Scrollable thumbnail stack */}
      <div className="overflow-y-auto" style={{ maxHeight: 450 }}>
        {posts.map((p, i) => {
          const img = getThumbnail(p.images as any);
          return (
            <div
              key={p.id}
              onClick={() => navigate(`/posts/${p.id}`)}
              className="relative cursor-pointer group overflow-hidden"
              style={{
                height: 150,
                borderBottom: i < posts.length - 1 ? "2px solid #fff" : "none",
              }}
            >
              <img
                src={img}
                alt={p.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              {/* Gradient overlay — strong bottom for legibility */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.38) 45%, rgba(0,0,0,0.04) 100%)",
                }}
              />
              {/* Title at bottom */}
              <p className="absolute bottom-3 left-3 right-3 text-[12px] font-semibold text-white line-clamp-2 leading-snug" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
                {p.title}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// SearchBar with dropdown filter
// ─────────────────────────────────────────
const SearchBar = ({
  keyword, setKeyword, sortBy: _sortBy, setSortBy, setCategory, category,
}: {
  keyword: string;
  setKeyword: (v: string) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  setCategory: (v: string) => void;
  category: string;
}) => {
  const [open, setOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "newest" | "oldest" | "popular">("all");
  const ref = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) setTypeOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const FILTER_OPTIONS = [
    { label: "Tất cả", value: "all" },
    { label: "Phổ biến", value: "popular" },
    { label: "Mới nhất", value: "newest" },
    { label: "Cũ nhất", value: "oldest" },
  ];

  const activeLabel = FILTER_OPTIONS.find(o => o.value === activeFilter)?.label ?? "Tất cả";
  const activeTypeLabel = category === "all" ? "Loại bài" : (CATEGORY_TABS.find(t => t.value === category)?.label ?? "Loại bài");

  const handleSelect = (value: "all" | "newest" | "oldest" | "popular") => {
    if (value === "all") {
      setKeyword("");
      setCategory("all");
      setSortBy("newest");
    } else if (value === "popular") {
      setSortBy("popular");
    } else {
      setSortBy(value);
    }
    setActiveFilter(value);
    setOpen(false);
  };

  const handleTypeSelect = (value: string) => {
    setCategory(value);
    setTypeOpen(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
      {/* Search input */}
      <div className="relative flex-1">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Tìm kiếm bài viết..."
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-[13px] bg-transparent border-none focus:outline-none text-gray-700 placeholder-gray-400"
        />
        {keyword && (
          <button onClick={() => setKeyword("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-200 shrink-0" />

      {/* Type filter dropdown */}
      <div className="relative shrink-0" ref={typeRef}>
        <button
          onClick={() => setTypeOpen(o => !o)}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg border text-[13px] font-semibold transition-all whitespace-nowrap select-none"
          style={
            category !== "all"
              ? { background: "#eff4ff", borderColor: "#254b86", color: "#254b86" }
              : { background: "#fff", borderColor: "#e5e7eb", color: "#4b5563" }
          }
        >
          {/* Grid icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          {activeTypeLabel}
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ transition: "transform .2s", transform: typeOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Type Dropdown */}
        {typeOpen && (
          <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50" style={{ minWidth: 160 }}>
            {CATEGORY_TABS.map(tab => {
              const isActive = category === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => handleTypeSelect(tab.value)}
                  className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
                  style={{ color: isActive ? "#254b86" : "#374151", fontWeight: isActive ? 700 : 500 }}
                >
                  {tab.label}
                  {isActive && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#254b86" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-200 shrink-0" />

      {/* Sort/Filter dropdown */}
      <div className="relative shrink-0" ref={ref}>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg border text-[13px] font-semibold transition-all whitespace-nowrap select-none"
          style={
            activeFilter === "popular"
              ? { background: "#fff7ed", borderColor: "#f97316", color: "#ea580c" }
              : { background: "#fff", borderColor: "#e5e7eb", color: "#4b5563" }
          }
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
          </svg>
          {activeLabel}
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ transition: "transform .2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50" style={{ minWidth: 150 }}>
            {FILTER_OPTIONS.map(opt => {
              const isActive = activeFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value as "all" | "newest" | "oldest" | "popular")}
                  className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
                  style={{ color: isActive ? (opt.value === "popular" ? "#ea580c" : "#254b86") : "#374151", fontWeight: isActive ? 700 : 500 }}
                >
                  <span className="flex items-center gap-2">
                    {opt.value === "popular" && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={isActive ? "#ea580c" : "#9ca3af"} stroke="none">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    )}
                    {opt.label}
                  </span>
                  {isActive && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={opt.value === "popular" ? "#ea580c" : "#254b86"} strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────
const NewsPage = () => {
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement>(null);

  // ── STATE ← GIỐNG HỆT FILE GỐC ──
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);

  // Reset page khi filter thay đổi  ← GIỐNG HỆT FILE GỐC
  useEffect(() => { setPage(1); }, [keyword, category, sortBy]);

  // Fetch posts  ← GIỐNG HỆT FILE GỐC
  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}?page=1&limit=500`);
      setAllPosts(res?.data?.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // ── DERIVED DATA ← GIỐNG HỆT FILE GỐC ──

  const featuredPost = useMemo(() =>
    [...allPosts].sort((a, b) => {
      if (a.isVip && !b.isVip) return -1;
      if (!a.isVip && b.isVip) return 1;
      return new Date(b.postedAt ?? b.createdAt ?? 0).getTime() - new Date(a.postedAt ?? a.createdAt ?? 0).getTime();
    })[0],
    [allPosts]
  );

  const latestPosts = useMemo(() =>
    [...allPosts]
      .sort((a, b) => new Date(b.postedAt ?? b.createdAt ?? 0).getTime() - new Date(a.postedAt ?? a.createdAt ?? 0).getTime())
      .slice(0, 5),
    [allPosts]
  );

  const popularPosts = useMemo(() => allPosts.slice(0, 5), [allPosts]);

  const filteredPosts = useMemo(() => {
    const kw = keyword.toLowerCase().trim();
    let list = allPosts.filter(p => {
      if (kw && !p.title?.toLowerCase().includes(kw) && !(p as any).description?.toLowerCase().includes(kw)) return false;
      if (category !== "all" && (p.postType ?? (p as any).type) !== category) return false;
      if (sortBy === "popular" && !p.isVip) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const ta = new Date(a.postedAt ?? a.createdAt ?? 0).getTime();
      const tb = new Date(b.postedAt ?? b.createdAt ?? 0).getTime();
      if (sortBy === "popular") {
        // VIP first, then by newest
        if (a.isVip && !b.isVip) return -1;
        if (!a.isVip && b.isVip) return 1;
        return tb - ta;
      }
      return sortBy === "oldest" ? ta - tb : tb - ta;
    });
    return list;
  }, [allPosts, keyword, category, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE));

  const pagedPosts = useMemo(
    () => filteredPosts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE),
    [filteredPosts, page]
  );

  const hasFilter = !!(keyword || category !== "all" || sortBy !== "newest");

  const scrollToList = () =>
    window.scrollTo({ top: (listRef.current?.offsetTop ?? 0) - 24, behavior: "smooth" });

  // Hero: featuredPost ở đầu + latestPosts còn lại (tối đa 5 slide)
  const heroPosts = useMemo(() => {
    if (!featuredPost) return latestPosts.slice(0, 5);
    const rest = latestPosts.filter(p => p.id !== featuredPost.id).slice(0, 4);
    return [featuredPost, ...rest];
  }, [featuredPost, latestPosts]);

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "#f0f2f5" }}>

      {/* ── Hero Slider ── */}
      {!loading && heroPosts.length > 0 && (
        <HeroSlider posts={heroPosts} onNavigate={(id) => navigate(`/posts/${id}`)} />
      )}

      <div className="max-w-[1200px] mx-auto px-4 py-8 space-y-5">

        {/* ── Search bar — ô tìm kiếm + nút filter dropdown ── */}
        <SearchBar
          keyword={keyword}
          setKeyword={setKeyword}
          sortBy={sortBy}
          setSortBy={setSortBy}
          setCategory={setCategory}
          category={category}
        />

        {/* ── Main layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">

          {/* ── Left: Danh sách tin đăng ── */}
          <div ref={listRef}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#254b86] flex items-center justify-center shrink-0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="white" />
                </svg>
              </div>
              <h2 className="text-[16px] font-bold text-gray-800">Danh sách tin đăng</h2>
              <span className="text-[10px] font-bold tracking-wide uppercase text-[#254b86] bg-blue-50 border border-blue-100 rounded-full px-2.5 py-[3px]">
                {filteredPosts.length} tin
              </span>
              {hasFilter && filteredPosts.length !== allPosts.length && (
                <span className="text-[11px] text-gray-400">(đang lọc)</span>
              )}
            </div>
            <div className="h-[3px] rounded-sm mb-5" style={{ background: "linear-gradient(90deg, #254b86 0%, #dbeafe 55%, transparent 100%)" }} />

            {loading ? (
              <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
                <svg className="animate-spin w-5 h-5 text-[#254b86]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span className="text-sm">Đang tải bài viết...</span>
              </div>
            ) : pagedPosts.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-xl border border-gray-100">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-400 font-medium text-sm">Không tìm thấy bài viết nào</p>
                {hasFilter && (
                  <button
                    onClick={() => { setKeyword(""); setCategory("all"); setSortBy("newest"); }}
                    className="mt-3 text-sm text-[#254b86] font-semibold hover:underline"
                  >
                    Xóa bộ lọc để xem tất cả
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  {pagedPosts.map(post => (
                    <ListCard key={post.id} post={post} />
                  ))}
                </div>

                {/* Pagination ← props giống hệt file gốc */}
                <Pagination
                  page={page}
                  total={totalPages}
                  totalCount={filteredPosts.length}
                  perPage={POSTS_PER_PAGE}
                  onChange={p => { setPage(p); scrollToList(); }}
                />
              </>
            )}
          </div>

          {/* ── Right: Sidebar ← data sources giống hệt file gốc ── */}
          <aside className="space-y-5 lg:sticky lg:top-6">

            {/* popularPosts → Bài Viết Nổi Bật */}
            <SidebarFeatured posts={popularPosts} />

            {/* latestPosts → Bài Viết Mới Nhất */}
            <SidebarLatest posts={latestPosts} />

            {/* Chủ đề / Tags ← GIỐNG HỆT FILE GỐC */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="w-1 h-5 bg-[#254b86] rounded-full" />
                <h3 className="font-semibold text-sm text-gray-800">Chủ đề</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_TABS.filter(t => t.value !== "all").map(tag => (
                  <button
                    key={tag.value}
                    onClick={() => { setCategory(tag.value); scrollToList(); }}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${category === tag.value
                      ? "bg-[#254b86] border-[#254b86] text-white"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:border-[#254b86] hover:text-[#254b86]"
                      }`}
                  >
                    {tag.label}
                    <span className="ml-1 opacity-60">
                      {allPosts.filter(p => (p.postType ?? (p as any).type) === tag.value).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </aside>
        </div>
      </div>
    </div>
  );
};

export default NewsPage;