import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker, Select, Radio } from 'antd';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { fengshuiApi } from '@/api/fengshui';
import { PropertyCard, Loading } from '@/components/common';
import dayjs from 'dayjs';


interface BatTrachItem {
    ten: string; loai: string; moTa: string; huong: string;
}
interface FengshuiResult {
    isVip: boolean;
    thongTinCaNhan: {
        ten: string; ngaySinh: string; loaiLich: string; gioiTinh: string;
        namAmLich: number; canChi: string;
        conGiap: { chi: string; ten: string; emoji: string; tinhCach: string; moTa: string };
        batMiBanMenh: {
            napAm: string; yNghiaNapAm: string; vanMenh: string;
            tamHop: string; tuHanhXung: string; soMayMan: string;
        }
    };
    menhCung: { menh: string; cungSo: number; tenCung: string; moTa: string; nguHanhSinh: string; nguHanhKhac: string; };
    batTrach: { cat: BatTrachItem[]; hung: BatTrachItem[]; };
    batDongSan: { nhaO: any[]; datDai: any[]; tongNha: number; tongDat: number };
    vipData: {
        phongThuyChiTiet: { mauSacHop: string[]; vatLieuHop: string[] };
        luuY: string[];
    } | null;
}


const MENH_COLOR: Record<string, { bg: string; text: string; border: string; dot: string; gradient: string; accent: string }> = {
    'Kim': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300', dot: 'bg-yellow-500', gradient: 'from-yellow-600 to-amber-400', accent: '#b45309' },
    'Mộc': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300', dot: 'bg-green-600', gradient: 'from-green-700 to-emerald-500', accent: '#15803d' },
    'Thủy': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', dot: 'bg-blue-600', gradient: 'from-blue-700 to-sky-500', accent: '#1d4ed8' },
    'Hỏa': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300', dot: 'bg-red-600', gradient: 'from-red-700 to-orange-500', accent: '#dc2626' },
    'Thổ': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300', dot: 'bg-orange-600', gradient: 'from-orange-600 to-amber-500', accent: '#c2410c' },
};

const PROVINCES = [
    'Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Huế',
    'Bình Dương', 'Đồng Nai', 'Khánh Hòa', 'Quảng Ninh', 'Nghệ An', 'Thanh Hóa',
    'Lâm Đồng', 'Bắc Ninh', 'Thái Nguyên',
].map(p => ({ label: p, value: p }));


const IconYinYang = () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" /><path d="M12 2a10 10 0 0 1 0 20A5 5 0 0 1 12 12a5 5 0 0 0 0-10z" fill="currentColor" stroke="none" />
        <circle cx="12" cy="7" r="1.5" fill="white" /><circle cx="12" cy="17" r="1.5" fill="currentColor" />
    </svg>
);
const IconStar = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
);
const IconCompass = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" stroke="none" />
    </svg>
);
const IconShield = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const IconWarning = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);
const IconCrown = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M2 19l2-9 4.5 5L12 4l3.5 11L20 10l2 9H2z" />
    </svg>
);
const IconPalette = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="13.5" cy="6.5" r="1" /><circle cx="17.5" cy="10.5" r="1" /><circle cx="8.5" cy="7.5" r="1" /><circle cx="6.5" cy="12.5" r="1" />
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10a5 5 0 0 0 5-5v-.5a1 1 0 0 0-1-1H15a1 1 0 0 1-1-1 1 1 0 0 1 1-1h1.5a5 5 0 0 0 5-5C21.5 6.48 17.28 2 12 2z" />
    </svg>
);
const IconLayers = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
);
const IconHome = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
);
const IconMap = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
    </svg>
);
const IconSparkle = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3c-.3 1.6-.8 3-1.6 4.4C9.6 8.8 8.2 10 6.5 11c1.7 1 3.1 2.2 3.9 3.6.8 1.4 1.3 2.8 1.6 4.4.3-1.6.8-3 1.6-4.4.8-1.4 2.2-2.6 3.9-3.6-1.7-1-3.1-2.2-3.9-3.6C12.8 6 12.3 4.6 12 3zm-7 7c-.2 1-.5 1.9-1 2.7-.5.8-1.2 1.5-2 2 .8.5 1.5 1.2 2 2s.8 1.7 1 2.7c.2-1 .5-1.9 1-2.7.5-.8 1.2-1.5 2-2-.8-.5-1.5-1.2-2-2-.5-.8-.8-1.7-1-2.7zm14 0c-.2 1-.5 1.9-1 2.7-.5.8-1.2 1.5-2 2 .8.5 1.5 1.2 2 2s.8 1.7 1 2.7c.2-1 .5-1.9 1-2.7.5-.8 1.2-1.5 2-2-.8-.5-1.5-1.2-2-2-.5-.8-.8-1.7-1-2.7z" />
    </svg>
);


const BatTrachCard = ({ item, isGood }: { item: BatTrachItem; isGood: boolean }) => (
    <div className={`relative flex flex-col rounded-2xl p-5 border bg-white overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 ${isGood ? 'border-green-100' : 'border-red-100'}`}>
        {/* Left accent bar */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${isGood ? 'bg-gradient-to-b from-green-400 to-emerald-600' : 'bg-gradient-to-b from-red-400 to-rose-600'}`} />
        <div className="flex items-start justify-between mb-3 pl-2">
            <span className={`font-bold text-[13px] uppercase tracking-wider ${isGood ? 'text-green-700' : 'text-red-600'}`}>
                {item.ten}
            </span>
            <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-full ${isGood ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                {item.huong}
            </span>
        </div>
        <p className="text-[13px] text-gray-500 leading-relaxed pl-2">{item.moTa}</p>
    </div>
);


const VipBanner = ({ navigate }: { navigate: any }) => (
    <div className="relative overflow-hidden rounded-2xl mt-6" style={{ background: 'linear-gradient(135deg, #78350f, #b45309, #d97706)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, white, transparent)', transform: 'translate(30%, -30%)' }} />
        <div className="relative p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-amber-200 shrink-0 mt-0.5">
                    <IconCrown />
                </div>
                <div>
                    <h3 className="text-[16px] font-bold text-white mb-1">Nâng cấp VIP để xem thêm</h3>
                    <p className="text-[13px] text-amber-200/90 leading-relaxed">
                        Gợi ý màu sắc, vật liệu xây dựng và phân tích lưu ý phong thủy chuyên sâu.
                    </p>
                </div>
            </div>
            <button
                onClick={() => navigate('/vip-upgrade')}
                className="shrink-0 px-6 py-2.5 bg-white text-amber-700 font-bold rounded-xl text-[14px] hover:bg-amber-50 transition-colors shadow-lg whitespace-nowrap"
            >
                Mua VIP
            </button>
        </div>
    </div>
);


const SectionTitle = ({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) => (
    <h3 className="text-[18px] font-bold text-[#1a1a1a] mb-6 flex items-center gap-3">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#0f2744] text-white shrink-0">
            {icon ?? <IconCompass />}
        </span>
        {children}
    </h3>
);


const FengshuiPage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    const [form, setForm] = useState({
        name: '', birthDate: '', calendarType: 'solar' as 'solar' | 'lunar',
        gender: 'male' as 'male' | 'female', location: ''
    });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<FengshuiResult | null>(null);
    const [activeTab, setActiveTab] = useState<'nha' | 'dat'>('nha');

    const handleSubmit = async () => {
        if (!isAuthenticated) { toast('Vui lòng đăng nhập để sử dụng'); navigate('/login'); return; }
        if (!form.name.trim()) { toast.error('Vui lòng nhập họ tên'); return; }
        if (!form.birthDate) { toast.error('Vui lòng chọn ngày sinh'); return; }
        setLoading(true);
        try {
            const res = await fengshuiApi.analyze(form);
            setResult(res.data);
            setTimeout(() => document.getElementById('fengshui-result')?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch {
            toast.error('Có lỗi xảy ra, vui lòng thử lại');
        } finally {
            setLoading(false);
        }
    };

    const menhColor = result ? (MENH_COLOR[result.menhCung.menh] ?? MENH_COLOR['Thổ']) : null;

    return (
        <div className="w-full pb-20" style={{ background: '#f4f6fb' }}>

            {/* ── HERO ─────────────────────────────────────────────── */}
            <div className="relative w-full overflow-hidden" style={{ minHeight: 280, background: 'linear-gradient(135deg, #060d1f 0%, #0f2744 45%, #1a3a6b 100%)' }}>
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 60% at 70% 50%, rgba(37,75,134,0.5) 0%, transparent 70%)' }} />
                <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="absolute top-6 right-24 w-40 h-40 rounded-full opacity-[0.07] border border-white" style={{ animation: 'none' }} />
                <div className="absolute -bottom-10 -left-6 w-56 h-56 rounded-full opacity-[0.05] border border-white" />
                <div className="absolute top-1/2 right-8 w-20 h-20 rounded-full opacity-[0.08] bg-sky-400" style={{ filter: 'blur(30px)' }} />

                <div className="relative max-w-[1250px] mx-auto px-6 py-14 flex flex-col justify-center">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-sky-300 shrink-0" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                            <IconYinYang />
                        </div>
                        <div>
                            <h1 className="text-[34px] font-bold text-white leading-tight tracking-tight">
                                Dự báo phong thủy theo bản mệnh
                            </h1>
                            <p className="text-sky-300/80 text-[15px] mt-1.5">
                                Nhập thông tin để nhận phân tích phong thủy chuyên sâu
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1250px] mx-auto px-4 sm:px-6 lg:px-0 mt-10">

                {/* ── FORM ──────────────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-10">
                    <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#0f2744] flex items-center justify-center text-sky-300">
                            <IconCompass />
                        </div>
                        <h2 className="text-[16px] font-bold text-[#1a1a1a]">Nhập thông tin</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {/* Name */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Họ và tên *</label>
                            <input
                                type="text" placeholder="Nguyễn Văn A"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="h-[44px] px-4 rounded-xl border border-gray-200 text-[14px] bg-gray-50 focus:outline-none focus:border-[#254b86] focus:bg-white transition-colors"
                            />
                        </div>
                        {/* Calendar type */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Loại lịch *</label>
                            <Radio.Group value={form.calendarType} onChange={(e) => setForm({ ...form, calendarType: e.target.value })} className="flex h-[44px] items-center gap-5">
                                <Radio value="solar">Dương lịch</Radio>
                                <Radio value="lunar">Âm lịch</Radio>
                            </Radio.Group>
                        </div>
                        {/* Birth date */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Ngày sinh *</label>
                            <DatePicker style={{ height: 44, borderRadius: 12, background: '#f9fafb', border: '1px solid #e5e7eb' }} format="DD/MM/YYYY" placeholder="DD/MM/YYYY" onChange={(date) => setForm({ ...form, birthDate: date ? dayjs(date).format('DD/MM/YYYY') : '' })} className="w-full" />
                        </div>
                        {/* Gender */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Giới tính *</label>
                            <Radio.Group value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="flex h-[44px] items-center gap-5">
                                <Radio value="male">Nam</Radio>
                                <Radio value="female">Nữ</Radio>
                            </Radio.Group>
                        </div>
                        {/* Location */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Địa điểm BĐS</label>
                            <Select style={{ height: 44 }} placeholder="Chọn tỉnh/thành phố" allowClear options={PROVINCES} onChange={(v) => setForm({ ...form, location: v || '' })} />
                        </div>
                        {/* Submit */}
                        <div className="flex flex-col gap-1.5 justify-end">
                            <button
                                onClick={handleSubmit} disabled={loading}
                                className="h-[44px] rounded-xl font-bold text-[14px] flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 text-white"
                                style={{ background: 'linear-gradient(135deg, #0f2744, #254b86)', boxShadow: '0 4px 16px rgba(37,75,134,0.35)' }}
                            >
                                <IconYinYang />
                                {loading ? 'Đang phân tích...' : 'Xem kết quả'}
                            </button>
                        </div>
                    </div>
                </div>

                {loading && <div className="flex justify-center py-20"><Loading /></div>}

                {!loading && result && (
                    <div id="fengshui-result" className="flex flex-col gap-7">

                        {/* ── PROFILE CARD ─────────────────────────── */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            {/* Colored header strip */}
                            <div className={`relative px-6 pt-6 pb-5 overflow-hidden ${menhColor?.bg}`} style={{ borderBottom: `3px solid` }}>
                                <div className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${menhColor?.accent}, transparent)`, transform: 'translate(30%, -30%)' }} />
                                <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-5" style={{ background: menhColor?.accent, transform: 'translate(-40%, 40%)' }} />
                                <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
                                    <div className={`w-24 h-24 rounded-2xl flex items-center justify-center text-5xl shrink-0 bg-white shadow-md border-2 ${menhColor?.border}`}>
                                        {result.thongTinCaNhan.conGiap.emoji}
                                    </div>
                                    <div className="flex-1">
                                        <h2 className={`text-[28px] font-bold ${menhColor?.text} leading-tight`}>{result.thongTinCaNhan.ten}</h2>
                                        <p className="text-gray-500 text-[13px] mt-1">
                                            {result.thongTinCaNhan.ngaySinh} ({result.thongTinCaNhan.loaiLich}) · {result.thongTinCaNhan.gioiTinh}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2 mt-3">
                                            <span className={`px-3 py-1.5 rounded-lg text-[13px] font-bold text-white shadow-sm bg-gradient-to-r ${menhColor?.gradient}`}>
                                                Mệnh {result.menhCung.menh}
                                            </span>
                                            <span className="px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-white text-gray-700 border border-gray-200 shadow-sm">
                                                {result.thongTinCaNhan.canChi}
                                            </span>
                                            <span className="px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-white text-gray-700 border border-gray-200 shadow-sm">
                                                {result.menhCung.tenCung}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bật mí bản mệnh */}
                            <div className="p-6">
                                <div className="flex items-center gap-2.5 mb-5">
                                    <span className={`flex items-center justify-center w-7 h-7 rounded-lg text-white ${menhColor?.dot}`}>
                                        <IconStar />
                                    </span>
                                    <h3 className="text-[16px] font-bold text-[#1a1a1a]">Bật mí bản mệnh</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { label: 'Nạp Âm', value: <><strong className={menhColor?.text}>{result.thongTinCaNhan.batMiBanMenh.napAm}</strong> <span className="italic text-gray-400 text-[12px]">({result.thongTinCaNhan.batMiBanMenh.yNghiaNapAm})</span></> },
                                        { label: 'Số may mắn', value: <strong className="text-[#254b86]">{result.thongTinCaNhan.batMiBanMenh.soMayMan}</strong> },
                                        { label: 'Tam Hợp', value: <><strong className="text-green-600">{result.thongTinCaNhan.batMiBanMenh.tamHop}</strong> <span className="text-[11px] text-gray-400 ml-1">Tốt</span></> },
                                        { label: 'Tứ Hành Xung', value: <><strong className="text-red-500">{result.thongTinCaNhan.batMiBanMenh.tuHanhXung}</strong> <span className="text-[11px] text-gray-400 ml-1">Tránh</span></> },
                                    ].map((row, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                                            <span className="text-[13px] text-gray-500 w-28 shrink-0">{row.label}</span>
                                            <span className="text-[14px]">{row.value}</span>
                                        </div>
                                    ))}
                                    <div className="md:col-span-2 p-4 rounded-xl bg-gray-50 border border-gray-100">
                                        <span className="font-semibold text-[13px] text-gray-600 block mb-2">Vận Cát - Hung</span>
                                        <p className="text-[13px] text-gray-600 leading-relaxed">{result.thongTinCaNhan.batMiBanMenh.vanMenh}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── BÁT TRẠCH ────────────────────────────── */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <SectionTitle icon={<IconCompass />}>Phân Tích Bát Trạch</SectionTitle>

                            {/* Hướng Cát */}
                            <div className="mb-7">
                                <div className="flex items-center gap-2.5 mb-4">
                                    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-green-600 text-white">
                                        <IconShield />
                                    </div>
                                    <h4 className="text-[14px] font-bold text-green-700 uppercase tracking-wide">Hướng nhà tốt (Cát)</h4>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {result.batTrach.cat.map((item, idx) => (
                                        <BatTrachCard key={idx} item={item} isGood={true} />
                                    ))}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="my-6 flex items-center gap-3">
                                <div className="flex-1 h-px bg-gray-100" />
                                <span className="text-[12px] text-gray-400 uppercase tracking-widest font-semibold">Cần tránh</span>
                                <div className="flex-1 h-px bg-gray-100" />
                            </div>

                            {/* Hướng Hung */}
                            <div>
                                <div className="flex items-center gap-2.5 mb-4">
                                    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-500 text-white">
                                        <IconWarning />
                                    </div>
                                    <h4 className="text-[14px] font-bold text-red-600 uppercase tracking-wide">Hướng cần tránh (Hung)</h4>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {result.batTrach.hung.map((item, idx) => (
                                        <BatTrachCard key={idx} item={item} isGood={false} />
                                    ))}
                                </div>
                            </div>

                            {!result.isVip && <VipBanner navigate={navigate} />}
                        </div>

                        {/* ── VIP DATA ─────────────────────────────── */}
                        {result.isVip && result.vipData && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                                    <div className="flex items-center gap-2.5 mb-5">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-600" style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)' }}>
                                            <IconCrown />
                                        </div>
                                        <h3 className="text-[16px] font-bold text-[#1a1a1a]">Màu sắc & Vật liệu phù hợp</h3>
                                    </div>
                                    <div className="mb-5">
                                        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                            <IconPalette /> Màu sắc hợp mệnh
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {result.vipData.phongThuyChiTiet.mauSacHop.map(mau => (
                                                <span key={mau} className="px-3 py-1.5 rounded-lg bg-[#254b86]/8 text-[#254b86] text-[13px] font-medium border border-[#254b86]/20">{mau}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                            <IconLayers /> Vật liệu nên dùng
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {result.vipData.phongThuyChiTiet.vatLieuHop.map(vl => (
                                                <span key={vl} className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-[13px] font-medium border border-green-200">{vl}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                                    <div className="flex items-center gap-2.5 mb-5">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-600" style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)' }}>
                                            <IconCrown />
                                        </div>
                                        <h3 className="text-[16px] font-bold text-[#1a1a1a]">Lưu ý chuyên sâu</h3>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {result.vipData.luuY.map((note, i) => (
                                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 text-[13px] text-gray-700">
                                                <span className="w-6 h-6 rounded-full text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5" style={{ background: 'linear-gradient(135deg, #0f2744, #254b86)' }}>{i + 1}</span>
                                                <span className="leading-relaxed">{note}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── BĐS GỢI Ý ───────────────────────────── */}
                        {result.isVip && (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-[#0f2744] flex items-center justify-center text-sky-300">
                                            <IconSparkle />
                                        </div>
                                        <h3 className="text-[17px] font-bold text-[#1a1a1a]">Bất động sản phù hợp cho bạn</h3>
                                    </div>
                                    {!result.isVip && (
                                        <span className="text-[12px] text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">
                                            VIP xem thêm 8 sản phẩm
                                        </span>
                                    )}
                                </div>

                                {/* Tabs */}
                                <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
                                    {[
                                        { key: 'nha', icon: <IconHome />, label: `Nhà ở (${result.batDongSan.tongNha})` },
                                        { key: 'dat', icon: <IconMap />, label: `Đất đai (${result.batDongSan.tongDat})` },
                                    ].map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setActiveTab(tab.key as 'nha' | 'dat')}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${activeTab === tab.key ? 'bg-white text-[#254b86] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            {tab.icon} {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {activeTab === 'nha' && (
                                    result.batDongSan.nhaO.length > 0
                                        ? <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">{result.batDongSan.nhaO.map(house => <PropertyCard key={house.id} property={house} type="house" />)}</div>
                                        : <div className="text-center py-14 text-gray-400 text-[14px]">Không có nhà ở phù hợp tại khu vực này</div>
                                )}
                                {activeTab === 'dat' && (
                                    result.batDongSan.datDai.length > 0
                                        ? <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">{result.batDongSan.datDai.map(land => <PropertyCard key={land.id} property={land} type="land" />)}</div>
                                        : <div className="text-center py-14 text-gray-400 text-[14px]">Không có đất đai phù hợp tại khu vực này</div>
                                )}
                            </div>
                        )}

                    </div>
                )}
            </div>
        </div>
    );
};

export default FengshuiPage;