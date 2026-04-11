import { useEffect, useState } from 'react';
import { Empty } from 'antd';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { landApi, propertyCategoryApi } from '@/api';
import { PropertyCard, Loading, PropertyListingFilters } from '@/components/common';
import { DEFAULT_PAGE_SIZE } from '@/constants';
import { useVietnamAddress } from '@/hooks/UseAddressVN';
import { buildProvinceCanonicalLookup, getLocalizedPropertyCategoryName, normalizeProvinceName, sortProvinceOptions } from '@/utils';
import type { Land, PropertyCategory } from '@/types';


interface CustomPaginationProps {
    current: number; total: number; pageSize: number; onChange: (page: number) => void;
}
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
        .filter((category) => category.categoryType === 'LAND')
        .map((category) => ({
            label: getLocalizedPropertyCategoryName(category.code, category.name),
            value: category.id,
        }));

    const [filters, setFilters] = useState({
        search: searchParams.get('search') || '',
        categoryId: searchParams.get('categoryId') || undefined,
        province: searchParams.get('province') || undefined,
        priceRange: searchParams.get('priceRange') || undefined,
        areaRange: searchParams.get('areaRange') || undefined,
        direction: searchParams.get('direction') || undefined,
        page: Number(searchParams.get('page')) || 1,
        limit: DEFAULT_PAGE_SIZE,
    });

    useEffect(() => { loadCategories(); fetchAllLands(); }, []);
    useEffect(() => { applyFiltersAndPagination(); }, [filters, allLands, provinceLookup]);

    const loadCategories = async () => {
        try {
            const res = await propertyCategoryApi.getAll();
            setCategories(res.data.data || res.data);
        } catch (e) { console.error(e); }
    };

    const fetchAllLands = async () => {
        setLoading(true);
        try {
            const res = await landApi.getAll({ page: 1, limit: 9999 });
            setAllLands(res.data.data || res.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };


    useEffect(() => {
        const provinceValues = allLands.flatMap((land: any) =>
            [land.city, land.province].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        );

        if (provinceValues.length === 0) {
            setProvinceLookup({});
            return;
        }

        let cancelled = false;
        buildProvinceCanonicalLookup(provinceValues).then((lookup: Record<string, string>) => {
            if (!cancelled) {
                setProvinceLookup(lookup);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [allLands]);
    const applyFiltersAndPagination = () => {
        let list = [...allLands];
        if (filters.search) {
            const kw = filters.search.toLowerCase();
            list = list.filter((l: any) =>
                l.title?.toLowerCase().includes(kw) || l.city?.toLowerCase().includes(kw) ||
                l.district?.toLowerCase().includes(kw) || l.ward?.toLowerCase().includes(kw) ||
                l.description?.toLowerCase().includes(kw)
            );
        }
        if (filters.categoryId) list = list.filter((l: any) => l.categoryId === Number(filters.categoryId));
        if (filters.province) {
            const selectedProvince = normalizeProvinceName(filters.province as string);
            list = list.filter((l: any) =>
                (l.city ? (provinceLookup[l.city] || normalizeProvinceName(l.city)) === selectedProvince : false) ||
                (l.province ? (provinceLookup[l.province] || normalizeProvinceName(l.province)) === selectedProvince : false)
            );
        }
        if (filters.direction) list = list.filter((l: any) => l.direction === filters.direction);
        if (filters.priceRange) {
            const [min, max] = filters.priceRange.split('-').map(Number);
            list = list.filter((l: any) => { const p = Number(l.price) || 0; return p >= min * 1e9 && p <= max * 1e9; });
        }
        if (filters.areaRange) {
            const [min, max] = filters.areaRange.split('-').map(Number);
            list = list.filter((l: any) => { const a = Number(l.area) || 0; return a >= min && a <= max; });
        }
        setTotal(list.length);
        const start = (filters.page - 1) * filters.limit;
        setLands(list.slice(start, start + filters.limit));
    };

    const handleFilterChange = (key: string, value: unknown) => {
        const next = { ...filters, [key]: value, page: key === 'page' ? (value as number) : 1 };
        setFilters(next);
        const params = new URLSearchParams();
        Object.entries(next).forEach(([k, v]) => { if (v !== undefined && v !== '') params.set(k, String(v)); });
        setSearchParams(params);
    };

    return (
        <div className="w-full bg-white pb-16">
            {/* Breadcrumb */}
            <div className="w-full bg-[#f4f5f7] py-3 mb-8">
                <div className="max-w-[1250px] mx-auto px-4 sm:px-6 lg:px-0 flex items-center gap-1.5 text-[13px]">
                    <button onClick={() => navigate('/')} className="text-gray-700 font-medium hover:text-[#254b86] transition-colors">Trang Chủ</button>
                    <span className="text-gray-400">›</span>
                    <span className="text-gray-500">Danh Sách Nhà Đất</span>
                </div>
            </div>

            <div className="max-w-[1250px] mx-auto px-4 sm:px-6 lg:px-0">
                <h1 className="text-[32px] font-bold text-[#1a1a1a] mb-8 tracking-tight">Danh Sách Nhà Đất</h1>

                {/* Filter bar */}
                <PropertyListingFilters
                    values={filters}
                    provinceOptions={provinceOptions}
                    categoryOptions={landCategoryOptions}
                    onChange={handleFilterChange}
                    searchPlaceholder="Tìm kiếm bất động sản"
                    categoryPlaceholder="Loại"
                />

                {/* Danh sách */}
                {loading ? (
                    <div className="flex justify-center items-center py-20 min-h-[400px]"><Loading /></div>
                ) : lands.length === 0 ? (
                    <div className="flex justify-center items-center py-20 min-h-[400px]"><Empty description="Không có kết quả phù hợp" /></div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {lands.map((land) => (
                                <PropertyCard key={land.id} property={land as any} type="land" />
                            ))}
                        </div>
                        <CustomPagination current={filters.page} total={total} pageSize={filters.limit} onChange={(page) => handleFilterChange('page', page)} />
                    </>
                )}
            </div>

        </div>
    );
};

export default LandListPage;