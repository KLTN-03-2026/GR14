import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend,
} from 'recharts';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';

/* ─── Constants ─────────────────────────────────────────────────────── */
const CACHE_KEY = 'valuation_cache';

const UTILITY_ICONS: Record<string, string> = {
  school: '🏫', market: '🛒', hospital: '🏥', park: '🌳', bank: '🏦', default: '📍',
};

const PROPERTY_TYPES = [
  { value: 'Bán căn hộ chung cư', label: 'Căn hộ chung cư' },
  { value: 'Bán nhà riêng', label: 'Nhà riêng' },
  { value: 'Bán biệt thự, liền kề', label: 'Biệt thự / Liền kề' },
  { value: 'Bán nhà mặt phố', label: 'Nhà mặt phố' },
  { value: 'Bán đất', label: 'Đất nền' },
];

/* ─── Helpers ────────────────────────────────────────────────────────── */
const fmt = (v: number) => v >= 1e9 ? `${(v / 1e9).toFixed(2)} Tỷ` : `${(v / 1e6).toFixed(0)} Triệu`;
const fmtM2 = (v: number) => `${(v / 1e6).toFixed(1)} Tr/m²`;

/* ─── Sub-components ────────────────────────────────────────────────── */
const InputField = ({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">{icon} {label}</label>
    {children}
  </div>
);

const StatCard = ({ value, label }: { value: string; label: string }) => (
  <div className="text-center">
    <div className="text-2xl font-extrabold text-emerald-400">{value}</div>
    <div className="text-xs text-white/40 mt-1">{label}</div>
  </div>
);

const SectionCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 ${className}`}>
    {children}
  </div>
);


const SectionTitle = ({ icon, title }: { icon: string; title: string }) => (
  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
    <span>{icon}</span>{title}
  </h3>
);

/* ─── Main Page ─────────────────────────────────────────────────────── */
const ValuationPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Check VIP còn hạn
  const isVipActive = () => {
    if (!user?.isVip || !user?.vipExpiry) return false;
    return new Date(user.vipExpiry) > new Date();
  };

  // Form state
  const [address, setAddress] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [area, setArea] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [floors, setFloors] = useState('');
  const [frontWidth, setFrontWidth] = useState('');
  const [direction, setDirection] = useState('Không rõ');
  const [legalStatus, setLegalStatus] = useState('Không rõ');

  // Restore cache on mount
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { formValues, resultData } = JSON.parse(cached);
        setAddress(formValues.address || '');
        setPropertyType(formValues.propertyType || '');
        setArea(formValues.area || '');
        setBedrooms(formValues.bedrooms || '');
        setBathrooms(formValues.bathrooms || '');
        setFloors(formValues.floors || '');
        setFrontWidth(formValues.frontWidth || '');
        setDirection(formValues.direction || 'Không rõ');
        setLegalStatus(formValues.legalStatus || 'Không rõ');
        setResult(resultData);
      }
    } catch { /* ignore */ }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !propertyType || !area) {
      toast.error('Vui lòng điền đầy đủ thông tin!');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const parts = address.split(',').map((s) => s.trim());
      const districtName = parts.length > 1 ? parts[0] : 'Không rõ';
      const provinceName = parts.length > 1 ? parts[1] : parts[0];
      const { data } = await apiClient.post('/valuation/estimate', {
        provinceName, districtName,
        propertyTypeName: propertyType,
        area: parseFloat(area),
        bedroomCount: parseInt(bedrooms) || 0,
        bathroomCount: parseInt(bathrooms) || 0,
        floors: parseInt(floors) || 0,
        frontWidth: parseFloat(frontWidth) || 0,
        direction,
        legalStatus,
      });
      if (data.success) {
        setResult(data.data);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          formValues: { address, propertyType, area, bedrooms, bathrooms, floors, frontWidth, direction, legalStatus },
          resultData: data.data,
        }));
        toast.success('Định giá thành công!');
      } else {
        toast.error('Lỗi khi định giá');
      }
    } catch {
      toast.error('Có lỗi xảy ra, thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  /* ─── RENDER ─────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ══════ HERO ══════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-teal-900 py-16 pb-20">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-24 -right-16 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-screen-xl px-6 flex flex-wrap items-center gap-12">

          {/* Left copy */}
          <div className="flex-1 min-w-[300px]">
            {/* Badge */}
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">AI-Powered Valuation</span>
            </div>

            <h1 className="mb-4 text-4xl font-black leading-tight text-white md:text-5xl">
              Định giá BĐS<br />
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                chính xác & tức thì
              </span>
            </h1>
            <p className="mb-8 max-w-md text-base leading-relaxed text-white/60">
              Mô hình AI phân tích <span className="font-bold text-white">3.5 triệu</span> giao dịch thực tế trên toàn quốc,
              cho kết quả trong vài giây.
            </p>

            {/* Stats */}
            <div className="flex gap-8">
              <StatCard value="3.5M+" label="Dữ liệu giao dịch" />
              <StatCard value="63" label="Tỉnh thành" />
              <StatCard value="95%" label="Độ chính xác" />
            </div>
          </div>

          {/* Right form card — chỉ VIP mới dùng được */}
          <div className="w-full max-w-md flex-shrink-0">
            {isVipActive() ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-7 shadow-2xl">
              <h2 className="mb-5 flex items-center gap-2.5 text-lg font-bold text-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 text-base">🔍</span>
                Tra cứu định giá
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <InputField label="Địa chỉ" icon="📍">
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="VD: Hải Châu, Đà Nẵng"
                    className="w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/35 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition"
                  />
                </InputField>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <InputField label="Loại hình" icon="🏠">
                      <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="w-full rounded-xl border border-white/15 bg-slate-800 px-4 py-3 text-sm text-white focus:border-emerald-400/60 focus:outline-none transition">
                        <option value="" disabled>Chọn loại</option>
                        {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </InputField>
                  </div>
                  <div className="flex-1">
                    <InputField label="Diện tích (m²)" icon="📐">
                      <input type="number" value={area} onChange={(e) => setArea(e.target.value)} placeholder="80" min={1} className="w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/35 focus:border-emerald-400/60 focus:outline-none transition" />
                    </InputField>
                  </div>
                </div>

                {/* Additional ML Features */}
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Phòng ngủ" icon="🛏️">
                    <input type="number" value={bedrooms} onChange={e=>setBedrooms(e.target.value)} placeholder="0" min={0} className="w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/35 focus:border-emerald-400/60 focus:outline-none transition" />
                  </InputField>
                  <InputField label="Phòng tắm" icon="🛁">
                    <input type="number" value={bathrooms} onChange={e=>setBathrooms(e.target.value)} placeholder="0" min={0} className="w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/35 focus:border-emerald-400/60 focus:outline-none transition" />
                  </InputField>
                  <InputField label="Số tầng" icon="🏢">
                    <input type="number" value={floors} onChange={e=>setFloors(e.target.value)} placeholder="1" min={0} className="w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/35 focus:border-emerald-400/60 focus:outline-none transition" />
                  </InputField>
                  <InputField label="Mặt tiền (m)" icon="📏">
                    <input type="number" value={frontWidth} onChange={e=>setFrontWidth(e.target.value)} placeholder="5" min={0} className="w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/35 focus:border-emerald-400/60 focus:outline-none transition" />
                  </InputField>
                  <InputField label="Hướng" icon="🧭">
                    <select value={direction} onChange={e=>setDirection(e.target.value)} className="w-full rounded-xl border border-white/15 bg-slate-800 px-4 py-3 text-sm text-white focus:border-emerald-400/60 focus:outline-none transition">
                      <option value="Không rõ">Không rõ</option>
                      <option value="Đông">Đông</option>
                      <option value="Tây">Tây</option>
                      <option value="Nam">Nam</option>
                      <option value="Bắc">Bắc</option>
                      <option value="Đông Nam">Đông Nam</option>
                      <option value="Đông Bắc">Đông Bắc</option>
                      <option value="Tây Nam">Tây Nam</option>
                      <option value="Tây Bắc">Tây Bắc</option>
                    </select>
                  </InputField>
                  <InputField label="Pháp lý" icon="📜">
                    <select value={legalStatus} onChange={e=>setLegalStatus(e.target.value)} className="w-full rounded-xl border border-white/15 bg-slate-800 px-4 py-3 text-sm text-white focus:border-emerald-400/60 focus:outline-none transition">
                      <option value="Không rõ">Không rõ</option>
                      <option value="Sổ đỏ/ Sổ hồng">Sổ đỏ/ Sổ hồng</option>
                      <option value="Hợp đồng mua bán">Hợp đồng mua bán</option>
                      <option value="Đang chờ sổ">Đang chờ sổ</option>
                    </select>
                  </InputField>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[.98]"
                >
                  {loading ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Đang phân tích...
                    </span>
                  ) : '✨ Xem kết quả định giá'}
                </button>
              </form>

              <p className="mt-3 text-center text-[11px] text-white/30">
                ℹ️ Kết quả chỉ mang tính tham khảo, dựa trên dữ liệu thị trường thực tế.
              </p>
            </div>
            ) : (
              /* ── VIP Gate Card ── */
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 backdrop-blur-xl p-7 shadow-2xl flex flex-col items-center text-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30 text-3xl">
                  👑
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white mb-2">Tính năng dành riêng cho VIP</h2>
                  <p className="text-sm text-white/60 leading-relaxed">
                    Định giá bất động sản bằng AI là quyền lợi độc quyền của thành viên VIP.
                    Nâng cấp ngay để trải nghiệm phân tích chính xác từ 3.5 triệu giao dịch thực tế.
                  </p>
                </div>
                <ul className="w-full text-left space-y-2">
                  {['Định giá chính xác theo AI', 'Biến động giá 12 tháng', 'Tiện ích xung quanh', 'Phân tích thị trường 2026', 'BĐS tham khảo tương đồng'].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-white/70">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/20 text-amber-400 text-xs">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/vip-upgrade?type=account')}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-500/30 transition hover:from-amber-300 hover:to-orange-400 active:scale-[.98]"
                >
                  👑 Nâng cấp VIP ngay
                </button>
                {!user && (
                  <p className="text-xs text-white/40">
                    Chưa có tài khoản?{' '}
                    <span
                      className="cursor-pointer text-amber-400 underline"
                      onClick={() => navigate('/login')}
                    >
                      Đăng nhập
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════ RESULTS ══════ */}
      {result && (
        <div className="mx-auto max-w-screen-xl px-6 py-10">

          {/* Result header */}
          <div className="mb-6">
            <span className="inline-block rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
              Kết quả phân tích AI
            </span>
            <h2 className="mt-2 text-2xl font-extrabold text-gray-900">Chi tiết định giá</h2>
            <p className="text-sm text-gray-400">📍 {address}</p>
          </div>

          {/* ── 3-col grid: each row = [wide 2/3] + [narrow 1/3] ── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

            {/* ── Row 1 Left: Price hero (col-span-2) ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950 p-7 text-white lg:col-span-2 flex flex-col">
              <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-emerald-500/15 blur-3xl" />
              <div className="relative">
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/40">Giá ước tính hiện tại</p>
                <p className="mb-3 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-5xl font-black text-transparent">
                  {fmt(result.estimation.currentValue)} <span className="text-2xl">VNĐ</span>
                </p>
                <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm">
                  <span>{area} m²</span>
                  <span className="text-white/30">•</span>
                  <span className="font-semibold text-emerald-400">{fmtM2(result.estimation.pricePerM2)}</span>
                </span>

                {/* Range bar */}
                <div className="mt-6">
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-400">
                    <div className="absolute left-1/2 top-0 h-full w-0.5 bg-white/80 -translate-x-1/2" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {[
                      { label: 'Giá sàn', val: result.estimation.minPriceM2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                      { label: 'Kỳ vọng', val: result.estimation.expectedPriceM2, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                      { label: 'Giá trần', val: result.estimation.maxPriceM2, color: 'text-red-400', bg: 'bg-red-500/10' },
                    ].map((item) => (
                      <div key={item.label} className={`rounded-xl px-3 py-3 text-center ${item.bg}`}>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">{item.label}</p>
                        <p className={`text-base font-extrabold ${item.color}`}>{fmtM2(item.val)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Row 1 Right: Radar (col-span-1) ── */}
            <SectionCard className="lg:col-span-1 flex flex-col h-full">
              <SectionTitle icon="⬟" title="Đánh giá đa chiều" />
              <div className="flex-1 min-h-0" style={{ minHeight: '220px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="65%" data={result.aiInsights.radar}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                    <Radar name="Điểm" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.3} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            {/* ── Row 2 Left: Area chart (col-span-2) ── */}
            <SectionCard className="lg:col-span-2 h-full">
              <div className="mb-4 flex items-center justify-between">
                <SectionTitle icon="📈" title="Biến động giá (2024–2025)" />
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-400">Triệu VNĐ/m²</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={result.trendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradAvg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <RechartsTooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.1)' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="avg" name="Trung bình" stroke="#10b981" fill="url(#gradAvg)" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} />
                    <Area type="monotone" dataKey="max" name="Giá trần" stroke="#f87171" fill="none" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                    <Area type="monotone" dataKey="min" name="Giá sàn" stroke="#fbbf24" fill="none" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            {/* ── Row 2 Right: Nearby utilities (col-span-1) ── */}
            <SectionCard className="lg:col-span-1 flex flex-col h-full">
              <SectionTitle icon="🗺️" title="Tiện ích xung quanh" />
              {result.nearbyUtilities?.length > 0 ? (
                <div className="flex flex-col gap-2.5 flex-1">
                  {result.nearbyUtilities.map((u: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 transition hover:bg-emerald-50 hover:translate-x-1"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
                          {UTILITY_ICONS[u.type] || UTILITY_ICONS.default}
                        </span>
                        <span className="text-sm font-semibold text-gray-700">{u.name}</span>
                      </div>
                      <span className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-3 py-1 text-[11px] font-bold text-white">
                        {u.distance}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-gray-400">Không có dữ liệu tiện ích</p>
              )}
            </SectionCard>

            {/* ── Row 3 Left: Market analysis (col-span-2) ── */}
            <SectionCard className="lg:col-span-2">
              <SectionTitle icon="🏙️" title="Phân tích thị trường 2026" />
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
                  <span className="text-sm text-gray-500">Tăng trưởng</span>
                  <span className="text-lg font-extrabold text-emerald-600">{result.aiInsights.growthRate}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
                  <span className="text-sm text-gray-500">Thanh khoản</span>
                  <span className="text-lg font-extrabold text-blue-600">{result.aiInsights.liquidity}</span>
                </div>
              </div>
              <blockquote className="rounded-xl border-l-4 border-emerald-400 bg-gray-50 py-3 pl-5 pr-4 text-sm italic leading-relaxed text-gray-600">
                "{result.aiInsights.analysisText}"
              </blockquote>
            </SectionCard>

            {/* ── Row 3 Right: BDS tham khảo (col-span-1) ── */}
            <SectionCard className="lg:col-span-1">
              <SectionTitle icon="📚" title="BĐS tham khảo" />
              {result.similarProperties.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {result.similarProperties.map((p: any) => (
                    <div
                      key={p.id}
                      onClick={() => navigate(p.type === 'land' ? `/lands/${p.id}` : `/houses/${p.id}`)}
                      className="flex cursor-pointer gap-3 rounded-xl border border-transparent p-2 transition hover:border-gray-200 hover:bg-gray-50 group"
                    >
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="h-14 w-14 flex-shrink-0 rounded-xl object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/60?text=No+img'; }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-800 group-hover:text-emerald-600 transition">
                          {p.title}
                        </p>
                        <p className="mt-1 text-sm font-extrabold text-emerald-600">
                          {fmt(p.price)}
                          <span className="ml-1.5 text-xs font-normal text-gray-400">{fmtM2(p.price / p.area)}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">{p.area}m² • {p.location}</p>
                      </div>
                      <svg className="h-4 w-4 flex-shrink-0 self-center text-gray-300 group-hover:text-emerald-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-gray-400">Chưa có dữ liệu BĐS tương đồng</p>
              )}
            </SectionCard>

          </div>
        </div>
      )}


    </div>
  );
};

export default ValuationPage;
