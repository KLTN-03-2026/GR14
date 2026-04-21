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

// Canonical target name → the normalized new (merged) province name used for matching
// Format: { "normalized_old_or_alias": "normalized_new_canonical" }
const PROVINCE_ALIASES: Record<string, string> = {
    // ── TP. Hồ Chí Minh (giữ nguyên, nhận Bình Dương + Bà Rịa-Vũng Tàu) ──
    'tp ho chi minh': 'thanh pho ho chi minh',
    'tp. ho chi minh': 'thanh pho ho chi minh',
    'tphcm': 'thanh pho ho chi minh',
    'sai gon': 'thanh pho ho chi minh',
    'ho chi minh': 'thanh pho ho chi minh',
    'thanh pho ho chi minh': 'thanh pho ho chi minh',
    // Bình Dương → TP.HCM
    'binh duong': 'thanh pho ho chi minh',
    // Bà Rịa-Vũng Tàu → TP.HCM
    'ba ria vung tau': 'thanh pho ho chi minh',
    'ba ria - vung tau': 'thanh pho ho chi minh',
    'ba ria vt': 'thanh pho ho chi minh',
    'baria vungtau': 'thanh pho ho chi minh',
    'vung tau': 'thanh pho ho chi minh',

    // ── Hà Nội (nhận Hòa Bình + Vĩnh Phúc) ──
    'ha noi': 'thanh pho ha noi',
    'thanh pho ha noi': 'thanh pho ha noi',
    'tp ha noi': 'thanh pho ha noi',
    // Hòa Bình → Hà Nội
    'hoa binh': 'thanh pho ha noi',
    // Vĩnh Phúc → Hà Nội
    'vinh phuc': 'thanh pho ha noi',

    // ── Hải Phòng (nhận Hải Dương) ──
    'hai phong': 'thanh pho hai phong',
    'thanh pho hai phong': 'thanh pho hai phong',
    'tp hai phong': 'thanh pho hai phong',
    // Hải Dương → Hải Phòng
    'hai duong': 'thanh pho hai phong',

    // ── Đà Nẵng (nhận Quảng Nam) ──
    'da nang': 'thanh pho da nang',
    'tp da nang': 'thanh pho da nang',
    'thanh pho da nang': 'thanh pho da nang',
    // Quảng Nam → Đà Nẵng
    'quang nam': 'thanh pho da nang',

    // ── Cần Thơ (nhận Hậu Giang + Sóc Trăng) ──
    'can tho': 'thanh pho can tho',
    'tp can tho': 'thanh pho can tho',
    'thanh pho can tho': 'thanh pho can tho',
    // Hậu Giang → Cần Thơ
    'hau giang': 'thanh pho can tho',
    // Sóc Trăng → Cần Thơ
    'soc trang': 'thanh pho can tho',

    // ── Huế (Thừa Thiên Huế + Quảng Trị) ──
    'hue': 'thanh pho hue',
    'thua thien hue': 'thanh pho hue',
    'thua thien - hue': 'thanh pho hue',
    'thanh pho hue': 'thanh pho hue',
    // Quảng Trị → Huế
    'quang tri': 'thanh pho hue',

    // ── Nghệ An (nhận Hà Tĩnh) ──
    'nghe an': 'nghe an',
    // Hà Tĩnh → Nghệ An
    'ha tinh': 'nghe an',

    // ── Thanh Hóa (nhận Ninh Bình) ──
    'thanh hoa': 'thanh hoa',
    // Ninh Bình → Thanh Hóa
    'ninh binh': 'thanh hoa',

    // ── Quảng Ninh (nhận Lạng Sơn) ──
    'quang ninh': 'quang ninh',
    // Lạng Sơn → Quảng Ninh
    'lang son': 'quang ninh',

    // ── Lào Cai (nhận Yên Bái) ──
    'lao cai': 'lao cai',
    // Yên Bái → Lào Cai
    'yen bai': 'lao cai',

    // ── Tuyên Quang (nhận Hà Giang) ──
    'tuyen quang': 'tuyen quang',
    // Hà Giang → Tuyên Quang
    'ha giang': 'tuyen quang',

    // ── Thái Nguyên (nhận Bắc Kạn) ──
    'thai nguyen': 'thai nguyen',
    // Bắc Kạn → Thái Nguyên
    'bac kan': 'thai nguyen',

    // ── Phú Thọ (nhận Tuyên Quang cũ → đã map trên; Phú Thọ nhận Tuyên Quang) ──
    // Thực tế: Phú Thọ nhận Tuyên Quang theo một số tài liệu - bỏ qua conflict, giữ tuyen quang riêng
    'phu tho': 'phu tho',

    // ── Bắc Ninh (nhận Bắc Giang) ──
    'bac ninh': 'bac ninh',
    // Bắc Giang → Bắc Ninh
    'bac giang': 'bac ninh',

    // ── Hưng Yên (nhận Nam Định + Thái Bình) ──
    'hung yen': 'hung yen',
    // Nam Định → Hưng Yên
    'nam dinh': 'hung yen',
    // Thái Bình → Hưng Yên
    'thai binh': 'hung yen',

    // ── Cao Bằng (nhận Bắc Kạn) → đã map bắc kạn → Thái Nguyên ──
    'cao bang': 'cao bang',

    // ── Lai Châu (nhận Điện Biên) ──
    'lai chau': 'lai chau',
    // Điện Biên → Lai Châu
    'dien bien': 'lai chau',

    // ── Sơn La (nhận Lào Cai cũ/phần → giữ nguyên sơn la) ──
    'son la': 'son la',

    // ── Lâm Đồng (nhận Bình Thuận + Ninh Thuận) ──
    'lam dong': 'lam dong',
    // Bình Thuận → Lâm Đồng
    'binh thuan': 'lam dong',
    // Ninh Thuận → Lâm Đồng
    'ninh thuan': 'lam dong',

    // ── Khánh Hòa (nhận Phú Yên) ──
    'khanh hoa': 'khanh hoa',
    // Phú Yên → Khánh Hòa
    'phu yen': 'khanh hoa',

    // ── Gia Lai (nhận Kon Tum + Bình Định) ──
    'gia lai': 'gia lai',
    // Kon Tum → Gia Lai
    'kon tum': 'gia lai',
    // Bình Định → Gia Lai
    'binh dinh': 'gia lai',

    // ── Đắk Lắk (nhận Đắk Nông) ──
    'dak lak': 'dak lak',
    'dac lac': 'dak lak',
    // Đắk Nông → Đắk Lắk
    'dak nong': 'dak lak',

    // ── Đồng Nai (nhận Bình Phước + Long An) ──
    'dong nai': 'dong nai',
    // Bình Phước → Đồng Nai
    'binh phuoc': 'dong nai',
    // Long An → Đồng Nai
    'long an': 'dong nai',

    // ── Tây Ninh (giữ nguyên) ──
    'tay ninh': 'tay ninh',

    // ── An Giang (nhận Kiên Giang) ──
    'an giang': 'an giang',
    // Kiên Giang → An Giang
    'kien giang': 'an giang',

    // ── Đồng Tháp (nhận Long An → đã map, nhận Tiền Giang) ──
    'dong thap': 'dong thap',
    // Tiền Giang → Đồng Tháp
    'tien giang': 'dong thap',

    // ── Vĩnh Long (nhận Bến Tre + Trà Vinh) ──
    'vinh long': 'vinh long',
    // Bến Tre → Vĩnh Long
    'ben tre': 'vinh long',
    // Trà Vinh → Vĩnh Long
    'tra vinh': 'vinh long',

    // ── Cà Mau (nhận Bạc Liêu) ──
    'ca mau': 'ca mau',
    // Bạc Liêu → Cà Mau
    'bac lieu': 'ca mau',

    // ── Quảng Ngãi (nhận một phần từ Bình Định → đã map Bình Định→Gia Lai) ──
    'quang ngai': 'quang ngai',
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
