import { useEffect, useState } from 'react';
import { Empty, Select } from 'antd';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { landApi, propertyCategoryApi } from '@/api';
import { PropertyCard, Loading } from '@/components/common';
import { DEFAULT_PAGE_SIZE } from '@/constants';
import { useVietnamAddress } from '@/hooks/UseAddressVN';
import { buildProvinceCanonicalLookup, getLocalizedPropertyCategoryName, normalizeProvinceName, sortProvinceOptions } from '@/utils';
import type { Land, PropertyCategory } from '@/types';

const { Option } = Select;

/* ── Price & Area ranges ─────────────────────────────────────────────── */
const PRICE_RANGES = [
    { label: 'Dưới 1 tỷ', value: '0-1' },
    { label: '1 - 3 tỷ', value: '1-3' },
    { label: '3 - 5 tỷ', value: '3-5' },
    { label: '5 - 10 tỷ', value: '5-10' },
    { label: '10 - 20 tỷ', value: '10-20' },
    { label: 'Trên 20 tỷ', value: '20-999999' },
];
const AREA_RANGES = [
    { label: 'Dưới 30 m²', value: '0-30' },
    { label: '30 - 50 m²', value: '30-50' },
    { label: '50 - 80 m²', value: '50-80' },
    { label: '80 - 120 m²', value: '80-120' },
    { label: 'Trên 120 m²', value: '120-99999' },
];
const DIRECTIONS = ['Đông', 'Tây', 'Nam', 'Bắc', 'Đông Nam', 'Đông Bắc', 'Tây Nam', 'Tây Bắc'];

/* ── Custom Pagination ────────────────────────────────────────────────── */
interface CustomPaginationProps { current: number; total: number; pageSize: number; onChange: (page: number) => void; }
const CustomPagination: React.FC<CustomPaginationProps> = ({ current, total, pageSize, onChange }) => {
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) return null;
    const pages: (number | string)[] = (() => {
        if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
        if (current <= 3) return [1, 2, 3, 4, '...', totalPages];
        if (current >= totalPages - 2) return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        return [1, '...', current - 1, current, current + 1, '...', totalPages];
    })();
    const btnBase = 'w-9 h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer';
    return (
        <div className="flex items-center justify-center gap-2 mt-12 mb-4">
            <button onClick={() => onChange(current - 1)} disabled={current === 1}
                className={`${btnBase} text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            {pages.map((page, i) => page === '...' ? (
                <span key={`d${i}`} className={`${btnBase} text-gray-500 font-bold tracking-widest`}>...</span>
            ) : (
                <button key={i} onClick={() => onChange(page as number)}
                    className={`${btnBase} text-[15px] font-semibold ${current === page ? 'bg-[#254b86] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
                    {page}
                </button>
            ))}
            <button onClick={() => onChange(current + 1)} disabled={current === totalPages}
                className={`${btnBase} text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
        </div>
    );
};

/* ── Checkbox Filter Item ─────────────────────────────────────────────── */
const FilterCheckbox: React.FC<{ label: string; checked: boolean; count?: number; onChange: () => void }> = ({ label, checked, count, onChange }) => (
    <label className="flex items-center justify-between gap-2 py-1.5 cursor-pointer group">
        <div className="flex items-center gap-2.5">
            <div
                onClick={onChange}
                className={`w-4 h-4 rounded flex items-center justify-center border transition-all flex-shrink-0 ${checked ? 'bg-[#0d9488] border-[#0d9488]' : 'border-gray-300 group-hover:border-[#0d9488]'}`}
            >
                {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
            </div>
            <span className={`text-[13px] ${checked ? 'text-[#111827] font-semibold' : 'text-gray-600 group-hover:text-gray-800'}`}>{label}</span>
        </div>
        {count !== undefined && <span className="text-[11px] text-gray-400 font-medium">{count.toLocaleString()}</span>}
    </label>
);

/* ── Filter Section ───────────────────────────────────────────────────── */
const FilterSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = true }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-gray-100 pb-4 mb-4">
            <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full mb-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{title}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" className={`transition-transform ${open ? '' : '-rotate-90'}`}><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {open && <div>{children}</div>}
        </div>
    );
};

/* ── Main Page ────────────────────────────────────────────────────────── */
const LandListPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const [allLands, setAllLands] = useState<Land[]>([]);
    const [lands, setLands] = useState<Land[]>([]);
    const [categories, setCategories] = useState<PropertyCategory[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [provinceLookup, setProvinceLookup] = useState<Record<string, string>>({});
    const { provinces } = useVietnamAddress();
    const provinceOptions = sortProvinceOptions(provinces);
    const landCategoryOptions = categories
        .filter((c) => c.categoryType === 'LAND')
        .map((c) => ({ label: getLocalizedPropertyCategoryName(c.code, c.name), value: String(c.id) }));

    const [filters, setFilters] = useState({
        search: searchParams.get('search') || '',
        categoryIds: searchParams.get('categoryIds')?.split(',').filter(Boolean) || [] as string[],
        province: searchParams.get('province') || undefined as string | undefined,
        priceRanges: searchParams.get('priceRanges')?.split(',').filter(Boolean) || [] as string[],
        areaRanges: searchParams.get('areaRanges')?.split(',').filter(Boolean) || [] as string[],
        directions: searchParams.get('directions')?.split(',').filter(Boolean) || [] as string[],
        page: Number(searchParams.get('page')) || 1,
        limit: DEFAULT_PAGE_SIZE,
    });

    useEffect(() => { loadCategories(); fetchAllLands(); }, []);
    useEffect(() => { applyFiltersAndPagination(); }, [filters, allLands, provinceLookup]);
    useEffect(() => {
        const provinceValues = allLands.flatMap((l: any) =>
            [l.city, l.province].filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        );
        if (!provinceValues.length) { setProvinceLookup({}); return; }
        let cancelled = false;
        buildProvinceCanonicalLookup(provinceValues).then((lookup) => { if (!cancelled) setProvinceLookup(lookup); });
        return () => { cancelled = true; };
    }, [allLands]);

    const loadCategories = async () => {
        try { const res = await propertyCategoryApi.getAll(); setCategories(res.data.data || res.data); } catch (e) { console.error(e); }
    };
    const fetchAllLands = async () => {
        setLoading(true);
        try { const res = await landApi.getAll({ page: 1, limit: 9999 }); setAllLands(res.data.data || res.data); }
        catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const applyFiltersAndPagination = () => {
        let list = [...allLands];
        if (filters.search) {
            const kw = filters.search.toLowerCase();
            list = list.filter((l: any) =>
                l.title?.toLowerCase().includes(kw) || l.city?.toLowerCase().includes(kw) ||
                l.district?.toLowerCase().includes(kw) || l.description?.toLowerCase().includes(kw)
            );
        }
        if (filters.categoryIds.length) list = list.filter((l: any) => filters.categoryIds.includes(String(l.categoryId)));
        if (filters.province) {
            const sel = normalizeProvinceName(filters.province);
            list = list.filter((l: any) =>
                (l.city ? (provinceLookup[l.city] || normalizeProvinceName(l.city)) === sel : false) ||
                (l.province ? (provinceLookup[l.province] || normalizeProvinceName(l.province)) === sel : false)
            );
        }
        if (filters.directions.length) list = list.filter((l: any) => filters.directions.includes(l.direction || ''));
        if (filters.priceRanges.length) {
            list = list.filter((l: any) => filters.priceRanges.some(r => {
                const [min, max] = r.split('-').map(Number);
                const p = Number(l.price) || 0;
                return p >= min * 1e9 && p <= max * 1e9;
            }));
        }
        if (filters.areaRanges.length) {
            list = list.filter((l: any) => filters.areaRanges.some(r => {
                const [min, max] = r.split('-').map(Number);
                const a = Number(l.area) || 0;
                return a >= min && a <= max;
            }));
        }
        setTotal(list.length);
        const start = (filters.page - 1) * filters.limit;
        setLands(list.slice(start, start + filters.limit));
    };

    const updateFilter = (key: string, value: unknown) => {
        const next = { ...filters, [key]: value, page: key === 'page' ? (value as number) : 1 };
        setFilters(next);
        const params = new URLSearchParams();
        Object.entries(next).forEach(([k, v]) => {
            if (Array.isArray(v) && v.length) params.set(k, v.join(','));
            else if (!Array.isArray(v) && v !== undefined && v !== '') params.set(k, String(v));
        });
        setSearchParams(params);
    };

    const toggleMulti = (key: 'priceRanges' | 'areaRanges' | 'directions' | 'categoryIds', val: string) => {
        const current = filters[key] as string[];
        const next = current.includes(val) ? current.filter(x => x !== val) : [...current, val];
        updateFilter(key, next);
    };

    const hasFilters = filters.categoryIds.length || filters.province || filters.priceRanges.length || filters.areaRanges.length || filters.directions.length || filters.search;
    const resetFilters = () => {
        setFilters({ search: '', categoryIds: [], province: undefined, priceRanges: [], areaRanges: [], directions: [], page: 1, limit: DEFAULT_PAGE_SIZE });
        setSearchParams(new URLSearchParams());
    };

    return (
        <div className="w-full pb-16" style={{ background: '#f6f7f9' }}>
            {/* Breadcrumb */}
            <div className="w-full bg-white border-b border-gray-100 py-3 mb-0">
                <div className="max-w-[1300px] mx-auto px-4 lg:px-6 flex items-center gap-1.5 text-[13px]">
                    <button onClick={() => navigate('/')} className="text-gray-500 hover:text-[#254b86] transition-colors">Trang Chủ</button>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                    <span className="text-gray-800 font-medium">Danh Sách Nhà Đất</span>
                </div>
            </div>

            <div className="max-w-[1300px] mx-auto px-4 lg:px-6 pt-6">
                {/* Page title + count */}
                <div className="mb-5">
                    <h1 className="text-[26px] font-bold text-[#1a1a1a] tracking-tight">Mua bán đất toàn quốc</h1>
                    <p className="text-[13px] text-gray-500 mt-1">Hiển thị <span className="font-semibold text-gray-700">{total.toLocaleString()}</span> tin — cập nhật trong 24 giờ qua</p>
                </div>

                {/* Two-column layout */}
                <div className="flex gap-6 items-start">

                    {/* ── LEFT SIDEBAR ─────────────────────────────────── */}
                    <aside className="w-[240px] flex-shrink-0 bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sticky top-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[15px] font-bold text-gray-800">Bộ lọc</span>
                            {hasFilters ? (
                                <button onClick={resetFilters} className="text-[12px] text-[#0d9488] hover:underline font-semibold flex items-center gap-1">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.5" /></svg>
                                    Reset
                                </button>
                            ) : null}
                        </div>

                        {/* Search inside sidebar */}
                        <div className="relative mb-4">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                            <input
                                type="text"
                                value={filters.search}
                                onChange={e => updateFilter('search', e.target.value)}
                                placeholder="Tìm theo từ khoá"
                                className="w-full pl-8 pr-3 py-2 bg-[#f6f7f9] border border-gray-200 rounded-lg text-[13px] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] transition-all"
                            />
                        </div>

                        {/* Location (dropdown) */}
                        <FilterSection title="Địa điểm">
                            <Select
                                allowClear
                                showSearch
                                placeholder="Chọn tỉnh / thành phố"
                                value={filters.province || undefined}
                                onChange={v => updateFilter('province', v)}
                                filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                                className="w-full"
                                size="small"
                                style={{ width: '100%', fontSize: 13 }}
                            >
                                {provinceOptions.map((p: any) => (
                                    <Option key={p.value || p.label} value={p.value || p.label} label={p.label}>{p.label}</Option>
                                ))}
                            </Select>
                        </FilterSection>

                        {/* Category */}
                        {landCategoryOptions.length > 0 && (
                            <FilterSection title="Loại đất">
                                {landCategoryOptions.map(opt => (
                                    <FilterCheckbox
                                        key={opt.value}
                                        label={opt.label}
                                        checked={filters.categoryIds.includes(opt.value)}
                                        onChange={() => toggleMulti('categoryIds', opt.value)}
                                    />
                                ))}
                            </FilterSection>
                        )}

                        {/* Price */}
                        <FilterSection title="Khoảng giá">
                            {PRICE_RANGES.map(r => (
                                <FilterCheckbox
                                    key={r.value}
                                    label={r.label}
                                    checked={filters.priceRanges.includes(r.value)}
                                    onChange={() => toggleMulti('priceRanges', r.value)}
                                />
                            ))}
                        </FilterSection>

                        {/* Area */}
                        <FilterSection title="Diện tích">
                            {AREA_RANGES.map(r => (
                                <FilterCheckbox
                                    key={r.value}
                                    label={r.label}
                                    checked={filters.areaRanges.includes(r.value)}
                                    onChange={() => toggleMulti('areaRanges', r.value)}
                                />
                            ))}
                        </FilterSection>

                        {/* Direction */}
                        <FilterSection title="Hướng" defaultOpen={false}>
                            {DIRECTIONS.map(d => (
                                <FilterCheckbox
                                    key={d}
                                    label={d}
                                    checked={filters.directions.includes(d)}
                                    onChange={() => toggleMulti('directions', d)}
                                />
                            ))}
                        </FilterSection>
                    </aside>

                    {/* ── RIGHT: Results ───────────────────────────────── */}
                    <div className="flex-1 min-w-0">
                        {loading ? (
                            <div className="flex justify-center items-center py-32"><Loading /></div>
                        ) : lands.length === 0 ? (
                            <div className="flex justify-center items-center py-32 bg-white rounded-2xl border border-gray-200">
                                <Empty description="Không có kết quả phù hợp" />
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {lands.map((land) => (
                                        <PropertyCard key={land.id} property={land as any} type="land" />
                                    ))}
                                </div>
                                <CustomPagination current={filters.page} total={total} pageSize={filters.limit} onChange={(page) => updateFilter('page', page)} />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LandListPage;