import { useNavigate } from "react-router-dom";
import { FiHeart } from "react-icons/fi";
import { FaHeart } from "react-icons/fa";

interface Post {
    id: number;
    title: string;
    city: string;
    district: string;
    ward: string;
    description: string;
    price: number;
    area: number;
    direction?: string | null;
    postedAt?: string | null;
    createdAt?: string | null; // 
    isVip?: boolean;
    images?: { url: string; position: number }[];
}

interface Props {
    post: Post;
    isFavorite?: boolean;
    onToggleFavorite?: () => void;
}

const formatPrice = (v?: number) => {
    if (!v && v !== 0) return "Liên hệ";
    if (v >= 1e9) return (v / 1e9).toFixed(1) + " tỷ";
    if (v >= 1e6) return (v / 1e6).toFixed(0) + " triệu";
    return v.toLocaleString("vi-VN") + " đ";
};

const getThumbnail = (images?: any[]) => {
    if (!images?.length) return "https://via.placeholder.com/600x400";
    return [...images].sort((a, b) => a.position - b.position)[0].url;
};

const formatDateTime = (d?: string | null) => {
    if (!d) return "";
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("vi-VN");
};

const NewsCard = ({ post, isFavorite, onToggleFavorite }: Props) => {
    const navigate = useNavigate();

    return (
        <div
            onClick={() => navigate(`/posts/${post.id}`)}
            className={`relative p-4 rounded-2xl flex gap-4 cursor-pointer transition hover:scale-[1.01]
      ${post.isVip
                    ? "bg-white border-2 border-orange-400 shadow-lg"
                    : "bg-white shadow hover:shadow-md"
                }`}
        >
            {/* FAVORITE */}
            <div className="absolute top-2 right-2 z-10">
                <button
                    onClick={(e) => {
                        e.stopPropagation(); // tránh click vào card
                        onToggleFavorite?.();
                    }}
                >
                    {isFavorite ? (
                        <FaHeart className="text-red-500 text-lg" />
                    ) : (
                        <FiHeart className="text-gray-400 text-lg" />
                    )}
                </button>
            </div>

            {/* IMAGE */}
            <div className="relative w-[240px] h-[160px]">
                <img
                    src={getThumbnail(post.images)}
                    className="w-full h-full object-cover rounded-xl"
                />

                {post.isVip && (
                    <span className="absolute top-2 left-2 bg-orange-500 text-white text-xs px-2 py-1 rounded">
                        VIP
                    </span>
                )}
            </div>

            {/* CONTENT */}
            <div className="flex-1">
                <h3 className="text-lg font-semibold">{post.title}</h3>

                <p className="text-sm text-gray-500 line-clamp-2">
                    {post.description}
                </p>

                <div className="flex gap-4 mt-2">
                    <span className="text-red-500 font-bold">
                        {formatPrice(post.price)}
                    </span>
                    <span>{post.area} m²</span>
                    <span>{post.direction || "Không rõ"}</span>
                </div>

                <div className="text-xs text-gray-500 mt-2">
                    📍 {post.ward}, {post.district}, {post.city}
                </div>

                <div className="text-xs text-gray-400 mt-1">
                    🕒 {formatDateTime(post.postedAt || post.createdAt)}
                </div>
            </div>
        </div>
    );
};

export default NewsCard;