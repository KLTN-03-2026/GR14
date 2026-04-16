import { useNavigate } from "react-router-dom";


const getThumbnail = (images?: any[]) => {
    if (!images?.length) return null;
    return [...images].sort((a, b) => a.position - b.position)[0].url;
};

const formatPrice = (v: number | null | undefined): string | null => {
    if (v === null || v === undefined || isNaN(Number(v))) return null;
    if (v >= 1e9) return (v / 1e9).toFixed(1) + " tỷ";
    if (v >= 1e6) return (v / 1e6).toFixed(0) + " triệu";
    return v.toLocaleString("vi-VN") + " đ";
};

const NewsMiniCard = ({ post }: { post: any }) => {
    const navigate = useNavigate();
    const thumb = getThumbnail(post.images);
    const price = formatPrice(post.price);

    return (
        <div
            onClick={() => navigate(`/posts/${post.id}`)}
            className="cursor-pointer bg-white rounded-xl overflow-hidden shadow hover:shadow-md transition"
        >
            <div className="relative">
                {thumb ? (
                    <img src={thumb} className="h-[140px] w-full object-cover" alt="" />
                ) : (
                    <div className="h-[140px] w-full bg-gray-100 flex items-center justify-center">
                        <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                )}

                {post.isVip && (
                    <span className="absolute top-2 left-2 bg-orange-500 text-white text-xs px-2 py-1 rounded">
                        VIP
                    </span>
                )}
            </div>

            <div className="p-2 text-sm">
                {price && (
                    <div className="text-red-500 font-bold">{price}</div>
                )}

                {post.area && <div>{post.area} m²</div>}

                <div className="text-gray-500 text-xs">
                    {[post.district, post.city].filter(Boolean).join(', ') || 'Chưa rõ địa chỉ'}
                </div>
            </div>
        </div>
    );
};

export default NewsMiniCard;