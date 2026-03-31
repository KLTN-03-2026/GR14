import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import NewsCard from "@/components/common/NewsCard";
import type { Post } from "@/types/post";

interface PostImage {
  url: string;
  position: number;
}

const API_URL = "http://localhost:5000/api/posts/approved";

const getThumbnail = (images?: PostImage[]) => {
  if (!images?.length)
    return "https://via.placeholder.com/600x400?text=No+Image";
  return [...images].sort((a, b) => a.position - b.position)[0]?.url;
};

const NewsPage = () => {
  const navigate = useNavigate();

  // Gộp chung vào một state duy nhất
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("favorites");
    if (stored) setFavorites(JSON.parse(stored));
  }, []);

  const toggleFavorite = (id: number) => {
    setFavorites((prev) => {
      const updated = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      localStorage.setItem("favorites", JSON.stringify(updated));
      return updated;
    });
  };

  // ===== FETCH POSTS =====
  const fetchPosts = async (pageNumber = 1, append = false) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}?page=${pageNumber}&limit=6`);
      const payload = res?.data || {};
      const newList: Post[] = payload.data || [];

      setHasMore(pageNumber < (payload.totalPages || 1));

      if (append) {
        setAllPosts((prev) => [...prev, ...newList]);
        setExpanded(true);
      } else {
        setAllPosts(newList);
        setExpanded(false);
      }
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(1);
  }, []);
  const sortedPosts = useMemo(() => {
    return [...allPosts].sort((a, b) => {

      if (a.isVip && !b.isVip) return -1;
      if (!a.isVip && b.isVip) return 1;
      return (
        new Date(b.postedAt || b.createdAt || 0).getTime() -
        new Date(a.postedAt || a.createdAt || 0).getTime()
      );
    });
  }, [allPosts]);

  // ===== HERO  =====
  const heroPost = useMemo(() => sortedPosts[0], [sortedPosts]);

  // ===== LATEST =====
  const latestPosts = useMemo(() => {
    return [...allPosts]
      .sort((a, b) =>
        new Date(b.postedAt || b.createdAt || 0).getTime() -
        new Date(a.postedAt || a.createdAt || 0).getTime()
      )
      .slice(0, 3);
  }, [allPosts]);

  // ===== MOST VIEWED =====
  const mostViewed = useMemo(() => sortedPosts.slice(0, 5), [sortedPosts]);

  const handleLoadMore = async () => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    await fetchPosts(next, true);
  };

  const handleCollapse = async () => {
    setPage(1);
    await fetchPosts(1);
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="max-w-[1200px] mx-auto px-4 py-6">

        {/* HERO + SIDEBAR */}
        {heroPost && (
          <div className="grid grid-cols-12 gap-4 mb-6">
            <div
              onClick={() => navigate(`/posts/${heroPost.id}`)}
              className="col-span-12 lg:col-span-8 relative rounded-2xl overflow-hidden cursor-pointer shadow-lg group"
            >
              <img
                src={getThumbnail(heroPost.images)}
                className="w-full h-[340px] object-cover group-hover:scale-105 transition duration-500"
                alt="hero"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 text-white">
                {heroPost.isVip && (
                  <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded mb-2 inline-block">VIP</span>
                )}
                <h2 className="text-xl font-bold line-clamp-2">{heroPost.title}</h2>
                <div className="text-sm opacity-80">
                  📍 {heroPost.district}, {heroPost.city}
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h3 className="font-bold mb-3 text-gray-800 flex items-center gap-2">
                  <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                  Bài viết mới đăng
                </h3>
                {latestPosts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/posts/${p.id}`)}
                    className="text-sm mb-2.5 cursor-pointer hover:text-orange-600 transition line-clamp-1 border-b border-gray-50 pb-1.5 last:border-0"
                  >
                    • {p.title}
                  </div>
                ))}
              </div>

              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold mb-3 text-gray-800 flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                  Bài viết xem nhiều
                </h3>
                {mostViewed.map((p, i) => (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/posts/${p.id}`)}
                    className="flex gap-3 py-2 border-b border-gray-50 last:border-0 cursor-pointer group"
                  >
                    <span className="text-orange-500 font-black italic opacity-50 group-hover:opacity-100 transition">
                      {i + 1}
                    </span>
                    <p className="text-sm line-clamp-1 group-hover:text-orange-600 transition">{p.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DANH SÁCH TỔNG HỢP */}
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            🏠 Danh sách tin đăng
            <span className="text-xs font-normal text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
              {allPosts.length} tin
            </span>
          </h2>

          <div className="space-y-4">
            {sortedPosts.map((post) => (
              <NewsCard
                key={post.id}
                post={post}
                isFavorite={favorites.includes(post.id)}
                onToggleFavorite={() => toggleFavorite(post.id)}
              />
            ))}

            {loading && (
              <div className="text-center py-4 text-gray-500">Đang tải thêm tin...</div>
            )}

            {!loading && sortedPosts.length === 0 && (
              <div className="text-center py-10 bg-white rounded-2xl shadow-sm text-gray-400">
                Không tìm thấy bài viết nào
              </div>
            )}
          </div>

          {/* NÚT ĐIỀU KHIỂN */}
          <div className="text-center mt-8">
            {hasMore ? (
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-8 py-2.5 bg-white border border-orange-500 text-orange-500 font-bold rounded-full hover:bg-orange-500 hover:text-white transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {loading ? "Đang xử lý..." : "Xem thêm tin đăng"}
              </button>
            ) : (
              expanded && (
                <button
                  onClick={handleCollapse}
                  className="px-8 py-2.5 border border-gray-300 text-gray-500 font-medium rounded-full hover:bg-gray-100 transition shadow-sm"
                >
                  Thu gọn danh sách
                </button>
              )
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default NewsPage;