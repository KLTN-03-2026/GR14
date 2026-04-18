export type ProvinceOption = {
    label: string;
    value: string;
};

export type ProvinceRecord = {
    province_code: string;
    name: string;
};

export type ProvinceSearchResult = {
    type?: 'province' | 'ward';
    province_code?: string;
    ward_code?: string;
    name?: string;
    ward_name?: string;
    matched_old_unit?: string;
    is_merger_match?: boolean;
};

const PROVINCE_ALIASES: Record<string, string> = {
    'ba ria vung tau': 'ba ria vung tau',
    'ba ria - vung tau': 'ba ria vung tau',
    'ba ria vt': 'ba ria vung tau',
    'ba ria vung tau (cu)': 'ba ria vung tau',
    'tp ho chi minh': 'ho chi minh',
    'tp. ho chi minh': 'ho chi minh',
    'tphcm': 'ho chi minh',
    'sai gon': 'ho chi minh',
    'ho chi minh': 'ho chi minh',
    'tp da nang': 'da nang',
    'da nang': 'da nang',
    'tp can tho': 'can tho',
    'can tho': 'can tho',
    'thua thien hue': 'hue',
    'hue': 'hue',
};

const PROVINCE_SEARCH_ENDPOINT = 'https://34tinhthanh.com/api/search';
const provinceResolutionCache = new Map<string, Promise<string>>();

export const normalizeVietnamText = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export const normalizeProvinceName = (value: string) => {
    const normalized = normalizeVietnamText(value);
    return PROVINCE_ALIASES[normalized] || normalized;
};

export const matchesProvinceName = (value: string | undefined, selectedProvince: string) => {
    if (!value) return false;

    const normalizedValue = normalizeProvinceName(value);
    const normalizedSelected = normalizeProvinceName(selectedProvince);

    return normalizedValue === normalizedSelected;
};

export const resolveProvinceCanonicalName = async (value: string) => {
    const normalized = normalizeProvinceName(value);
    if (!normalized) return '';

    const cached = provinceResolutionCache.get(normalized);
    if (cached) return cached;

    const request = (async () => {
        try {
            const response = await fetch(`${PROVINCE_SEARCH_ENDPOINT}?q=${encodeURIComponent(value)}`);
            if (!response.ok) return normalized;

            const data = (await response.json()) as ProvinceSearchResult[];
            const provinceMatch = Array.isArray(data)
                ? data.find((item) => item.type === 'province' && typeof item.name === 'string' && item.name.trim())
                : undefined;

            return provinceMatch?.name ? normalizeProvinceName(provinceMatch.name) : normalized;
        } catch {
            return normalized;
        }
    })();

    provinceResolutionCache.set(normalized, request);
    return request;
};

export const buildProvinceCanonicalLookup = async (values: string[]) => {
    const uniqueValues = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
    const entries = await Promise.all(
        uniqueValues.map(async (value) => [value, await resolveProvinceCanonicalName(value)] as const)
    );

    return Object.fromEntries(entries) as Record<string, string>;
};

export const sortProvinceOptions = (provinces: ProvinceRecord[]): ProvinceOption[] =>
    provinces
        .map((province) => ({ label: province.name, value: province.name }))
        .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
