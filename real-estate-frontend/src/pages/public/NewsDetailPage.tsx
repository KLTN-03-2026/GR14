import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import NewsMiniCard from "@/components/common/NewsMiniCard";

// ===== TYPES =====
interface PostImage {
    url: string;
    position: number;
}

interface User {
    id: number;
    fullName: string;
    phone?: string;
}

interface Post {
    id: number;
    title: string;
    city: string;
    district: string;
    ward: string;
    address: string;
    description: string;
    price: number;
    area: number;
    direction?: string;
    postedAt?: string;
    isVip?: boolean;
    user?: User;
    images?: PostImage[];
}

const API = "http://localhost:5000/api";

// ===== HELPERS =====
const getThumbnail = (images?: PostImage[]) => {
    if (!images?.length) return "https://via.placeholder.com/600x400";
    return [...images].sort((a, b) => a.position - b.position)[0].url;
};

const formatPrice = (v: number) => {
    if (v >= 1e9) return (v / 1e9).toFixed(1) + " tỷ";
    if (v >= 1e6) return (v / 1e6).toFixed(0) + " triệu";
    return v.toLocaleString("vi-VN") + " đ";
};

const maskPhone = (phone?: string, show = false) => {
    if (!phone) return "Đang cập nhật";
    if (show) return phone;

    const half = Math.ceil(phone.length / 2);
    return phone.slice(0, half) + "*".repeat(phone.length - half);
};

/**
 * Hàm xử lý tên hiển thị linh hoạt
 */
const getDisplayName = (fullName?: string) => {
    if (!fullName) return "Người dùng";
    // Kiểm tra nếu là System Admin thì đổi tên thương hiệu
    if (fullName.trim() === "System Admin") {
        return "Ban quản trị Black'S City";
    }
    return fullName;
};

const NewsDetailPage = () => {
    const { id } = useParams();

    const [post, setPost] = useState<Post | null>(null);
    const [list, setList] = useState<Post[]>([]);
    const [showPhone, setShowPhone] = useState(false);

    // ===== FETCH DATA =====
    const fetchData = async () => {
        try {
            const [detailRes, listRes] = await Promise.all([
                axios.get(`${API}/posts/${id}`),
                axios.get(`${API}/posts/approved?page=1&limit=9`)
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

    // ===== RELATED POSTS =====
    const related = useMemo(() => {
        return list.filter((p) => p.id !== Number(id));
    }, [list, id]);

    // ===== OTHER POSTS FROM SAME USER =====
    const userPosts = useMemo(() => {
        if (!post?.user?.id) return [];
        return list.filter(
            (p) => p.user?.id === post.user?.id && p.id !== post.id
        );
    }, [list, post]);

    if (!post) return <div className="p-6 text-center font-medium">Đang tải dữ liệu...</div>;

    const isAdmin = post.user?.fullName === "System Admin";

    return (
        <div className="bg-gray-100 min-h-screen py-6">
            <div className="max-w-[1200px] mx-auto px-4">

                {/* BANNER IMAGE + TITLE */}
                <div className="bg-white rounded-2xl p-4 shadow mb-6">
                    <img
                        src={getThumbnail(post.images)}
                        alt={post.title}
                        className="w-full h-[400px] object-cover rounded-xl"
                    />

                    <h1 className="text-2xl font-bold mt-4">{post.title}</h1>

                    <div className="text-red-500 text-xl font-bold mt-2">
                        {formatPrice(post.price)}
                    </div>

                    <div className="text-gray-500 mt-1">
                        📍 {post.address}
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-6">

                    {/* LEFT CONTENT */}
                    <div className="col-span-12 lg:col-span-8 space-y-6">

                        {/* ĐẶC ĐIỂM BẤT ĐỘNG SẢN */}
                        <div className="bg-white rounded-2xl p-4 shadow">
                            <h2 className="font-bold mb-4 text-lg border-b pb-2">Đặc điểm bất động sản</h2>

                            <div className="grid grid-cols-2 gap-y-3 text-sm">
                                <div className="text-gray-500">Diện tích</div>
                                <div className="font-medium">{post.area} m²</div>

                                <div className="text-gray-500">Giá</div>
                                <div className="font-medium text-red-600">{formatPrice(post.price)}</div>

                                <div className="text-gray-500">Hướng</div>
                                <div className="font-medium">
                                    {post.direction || "Không rõ"}
                                </div>

                                <div className="text-gray-500">Khu vực</div>
                                <div className="font-medium">
                                    {post.district}, {post.city}
                                </div>
                            </div>
                        </div>

                        {/* MÔ TẢ CHI TIẾT */}
                        <div className="bg-white rounded-2xl p-4 shadow">
                            <h2 className="font-bold mb-3 text-lg border-b pb-2">Mô tả chi tiết</h2>
                            <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                                {post.description}
                            </p>

                            <div className="mt-6 bg-blue-50 p-4 rounded-xl flex items-center justify-between border border-blue-100">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">📞</span>
                                    <span className="font-bold text-blue-700">
                                        {maskPhone(post.user?.phone, showPhone)}
                                    </span>
                                </div>

                                {!showPhone ? (
                                    <button
                                        onClick={() => setShowPhone(true)}
                                        className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                                    >
                                        Hiện số
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(post.user?.phone || "");
                                            alert("Đã sao chép số điện thoại!");
                                        }}
                                        className="text-blue-600 text-sm font-medium underline"
                                    >
                                        Sao chép
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* CÁC BÀI VIẾT TƯƠNG TỰ */}
                        <div className="bg-white rounded-2xl p-4 shadow">
                            <h2 className="font-bold mb-4 text-lg">Các bài viết tương tự</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {related.length > 0 ? (
                                    related.slice(0, 3).map((p) => (
                                        <NewsMiniCard key={p.id} post={p} />
                                    ))
                                ) : (
                                    <p className="text-gray-400 text-sm">Không có bài viết tương tự</p>
                                )}
                            </div>
                        </div>

                        {/* BÀI VIẾT KHÁC CỦA NGƯỜI DÙNG */}
                        {userPosts.length > 0 && (
                            <div className="bg-white rounded-2xl p-4 shadow border-t-4 border-blue-500">
                                <h2 className="font-bold mb-4 text-lg">
                                    Bài viết khác của {getDisplayName(post.user?.fullName)}
                                </h2>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {userPosts.map((p) => (
                                        <NewsMiniCard key={p.id} post={p} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT SIDEBAR (NGƯỜI ĐĂNG) */}
                    <div className="col-span-12 lg:col-span-4">
                        <div className="bg-white rounded-2xl p-5 shadow sticky top-6">
                            <h3 className="font-bold mb-4 text-gray-500 uppercase text-xs tracking-wider">Người đăng bài viết</h3>

                            <div className="flex flex-col items-center text-center">
                                {/* Avatar giả định */}
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-2xl font-bold mb-3">
                                    {getDisplayName(post.user?.fullName).charAt(0)}
                                </div>

                                <div className="font-bold text-lg flex items-center gap-1.5">
                                    {getDisplayName(post.user?.fullName)}
                                    {isAdmin && (
                                        <span title="Tài khoản xác thực" className="text-blue-500 text-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                            </svg>
                                        </span>
                                    )}
                                </div>

                                <div className="text-gray-500 mt-2 flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-full w-full justify-center border border-gray-100">
                                    <span>📞</span>
                                    <span className="font-semibold">{maskPhone(post.user?.phone, showPhone)}</span>
                                </div>

                                <button
                                    onClick={() => setShowPhone(true)}
                                    className="w-full mt-4 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-100"
                                >
                                    GỬI YÊU CẦU LIÊN HỆ
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default NewsDetailPage;