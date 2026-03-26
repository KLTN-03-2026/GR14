import { useNavigate } from "react-router-dom";

interface Post {
    id: number;
    city: string;
    district: string;
    price: number;
    area: number;
    isVip?: boolean;
    images?: { url: string; position: number }[];
}

const getThumbnail = (images?: any[]) => {
    if (!images?.length) return "https://via.placeholder.com/600x400";
    return [...images].sort((a, b) => a.position - b.position)[0].url;
};

const formatPrice = (v: number) => {
    if (v >= 1e9) return (v / 1e9).toFixed(1) + " tỷ";
    if (v >= 1e6) return (v / 1e6).toFixed(0) + " triệu";
    return v.toLocaleString("vi-VN") + " đ";
};

const NewsMiniCard = ({ post }: { post: Post }) => {
    const navigate = useNavigate();

    return (
        <div
            onClick={() => navigate(`/posts/${post.id}`)}
            className="cursor-pointer bg-white rounded-xl overflow-hidden shadow hover:shadow-md transition"
        >
            <div className="relative">
                <img
                    src={getThumbnail(post.images)}
                    className="h-[140px] w-full object-cover"
                />

                {post.isVip && (
                    <span className="absolute top-2 left-2 bg-orange-500 text-white text-xs px-2 py-1 rounded">
                        VIP
                    </span>
                )}
            </div>

            <div className="p-2 text-sm">
                <div className="text-red-500 font-bold">
                    {formatPrice(post.price)}
                </div>

                <div>{post.area} m²</div>

                <div className="text-gray-500 text-xs">
                    {post.district}, {post.city}
                </div>
            </div>
        </div>
    );
};

export default NewsMiniCard;