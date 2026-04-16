import { Input, Select } from 'antd';

export type FilterOption = {
    label: string;
    value: string | number;
};

export type ListingFiltersValue = {
    search: string;
    province?: string;
    priceRange?: string;
    areaRange?: string;
    direction?: string;
    categoryId?: string | number;
};

interface PropertyListingFiltersProps {
    values: ListingFiltersValue;
    provinceOptions: FilterOption[];
    categoryOptions: FilterOption[];
    onChange: (key: keyof ListingFiltersValue, value: unknown) => void;
    searchPlaceholder?: string;
    categoryPlaceholder?: string;
}

const PRICE_RANGES: FilterOption[] = [
    { label: 'Dưới 1 tỷ', value: '0-1' },
    { label: '1 - 2 tỷ', value: '1-2' },
    { label: '2 - 3 tỷ', value: '2-3' },
    { label: '3 - 5 tỷ', value: '3-5' },
    { label: '5 - 7 tỷ', value: '5-7' },
    { label: '7 - 10 tỷ', value: '7-10' },
    { label: '10 - 20 tỷ', value: '10-20' },
    { label: '20 - 50 tỷ', value: '20-50' },
    { label: 'Trên 50 tỷ', value: '50-999' },
];

const AREA_RANGES: FilterOption[] = [
    { label: 'Dưới 30 m²', value: '0-30' },
    { label: '30 - 50 m²', value: '30-50' },
    { label: '50 - 80 m²', value: '50-80' },
    { label: '80 - 100 m²', value: '80-100' },
    { label: '100 - 150 m²', value: '100-150' },
    { label: '150 - 200 m²', value: '150-200' },
    { label: '200 - 300 m²', value: '200-300' },
    { label: '300 - 500 m²', value: '300-500' },
    { label: 'Trên 500 m²', value: '500-9999' },
];

const DIRECTIONS: FilterOption[] = [
    'Đông',
    'Tây',
    'Nam',
    'Bắc',
    'Đông Bắc',
    'Đông Nam',
    'Tây Bắc',
    'Tây Nam',
].map((direction) => ({ label: direction, value: direction }));

const selectCommonProps = {
    className: 'h-[42px] w-full shrink-0',
    allowClear: true,
    showSearch: true,
    optionFilterProp: 'label',
    popupMatchSelectWidth: false,
    popupClassName: 'listing-filter-popup',
};

const PropertyListingFilters: React.FC<PropertyListingFiltersProps> = ({
    values,
    provinceOptions,
    categoryOptions,
    onChange,
    searchPlaceholder = 'Tìm kiếm bất động sản',
    categoryPlaceholder = 'Loại',
}) => {
    return (
        <div className="mb-10 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-6">
                <Input
                    className="h-[42px] w-full rounded-lg text-[14px] !border-[#d9d9d9] hover:!border-[#254b86] focus:!border-[#254b86] xl:col-span-2"
                    placeholder={searchPlaceholder}
                    value={values.search}
                    onChange={(e) => onChange('search', e.target.value)}
                    allowClear
                />
                <Select
                    {...selectCommonProps}
                    placeholder="Địa điểm"
                    value={values.province}
                    onChange={(v) => onChange('province', v)}
                    options={provinceOptions}
                />
                <Select
                    {...selectCommonProps}
                    placeholder="Giá bán"
                    value={values.priceRange}
                    onChange={(v) => onChange('priceRange', v)}
                    options={PRICE_RANGES}
                />
                <Select
                    {...selectCommonProps}
                    placeholder="Diện tích"
                    value={values.areaRange}
                    onChange={(v) => onChange('areaRange', v)}
                    options={AREA_RANGES}
                />
                <Select
                    {...selectCommonProps}
                    placeholder="Hướng"
                    value={values.direction}
                    onChange={(v) => onChange('direction', v)}
                    options={DIRECTIONS}
                />
                <Select
                    {...selectCommonProps}
                    placeholder={categoryPlaceholder}
                    value={values.categoryId}
                    onChange={(v) => onChange('categoryId', v)}
                    options={categoryOptions}
                />
            </div>

            <style>{`
                .listing-filter-popup {
                    min-width: 320px !important;
                }

                .listing-filter-popup .ant-select-item-option-content {
                    white-space: normal;
                    line-height: 1.35;
                }
            `}</style>
        </div>
    );
};

export default PropertyListingFilters;