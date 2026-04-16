import { useEffect, useState } from "react";
import { Home, Map, Calendar, FileText } from "lucide-react";
import { houseApi, landApi, appointmentApi, postApi } from "@/api";

const EmployeeDashboardPage = () => {
    const [stats, setStats] = useState({
        houses: 0,
        lands: 0,
        appointments: 0,
        posts: 0
    });

    useEffect(() => {
        const loadStats = async () => {
            try {
                const [hRes, lRes, aRes, pRes] = await Promise.allSettled([
                    houseApi.getMyHouses({ limit: 1 }),
                    landApi.getMyLands({ limit: 1 }),
                    appointmentApi.getAll({ limit: 1 } as any),
                    postApi.getAll({ limit: 1 } as any)
                ]);
                
                setStats({
                    houses: hRes.status === 'fulfilled' ? (hRes.value.data?.totalItems || hRes.value.data?.total || 0) : 0,
                    lands: lRes.status === 'fulfilled' ? (lRes.value.data?.totalItems || lRes.value.data?.total || 0) : 0,
                    appointments: aRes.status === 'fulfilled' ? (aRes.value.data?.totalItems || aRes.value.data?.total || 0) : 0,
                    posts: pRes.status === 'fulfilled' ? (pRes.value.data?.totalItems || pRes.value.data?.total || 0) : 0
                });
            } catch (error) {
                console.error("Lỗi tải thống kê", error);
            }
        };
        loadStats();
    }, []);

    const CARDS = [
        { label: "Tổng số nhà", value: stats.houses, icon: Home, colors: "bg-blue-50 text-blue-600 border-blue-200" },
        { label: "Tổng số đất", value: stats.lands, icon: Map, colors: "bg-green-50 text-green-600 border-green-200" },
        { label: "Lịch hẹn (Công ty)", value: stats.appointments, icon: Calendar, colors: "bg-purple-50 text-purple-600 border-purple-200" },
        { label: "Bài đăng (Công ty)", value: stats.posts, icon: FileText, colors: "bg-amber-50 text-amber-600 border-amber-200" },
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Tổng quan công việc</h1>
                <p className="text-gray-500 mt-1">Chào mừng bạn trở lại, chúc một ngày làm việc hiệu quả!</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {CARDS.map((card, idx) => (
                    <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">{card.label}</p>
                            <h3 className="text-3xl font-bold text-gray-900">{card.value}</h3>
                        </div>
                        <div className={`p-3 rounded-xl border ${card.colors}`}>
                            <card.icon size={24} strokeWidth={2} />
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[300px]">
                 <h2 className="text-lg font-semibold text-gray-900 mb-4">Chỉ dẫn</h2>
                 <ul className="list-disc pl-5 text-gray-600 space-y-2 text-sm max-w-2xl">
                     <li>Vui lòng kiểm tra <b>Lịch hẹn của tôi</b> thường xuyên và cập nhật <b>Trạng thái thực tế</b> sau khi gặp khách hàng.</li>
                     <li>Xét duyệt các bài đăng của người dùng nhanh chóng trong tab <b>Bài đăng</b>.</li>
                     <li>Khi tạo lịch hẹn cho khách, hãy kiểm tra thật kỹ các thông tin bất động sản liên quan.</li>
                 </ul>
            </div>
        </div>
    );
};

export default EmployeeDashboardPage;
