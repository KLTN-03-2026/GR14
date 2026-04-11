const CATEGORY_LABELS_VI: Record<string, string> = {
    HOUSE: 'Nhà ở',
    VILLA: 'Biệt thự',
    APARTMENT: 'Chung cư',
    TOWNHOUSE: 'Nhà phố',
    RESLAND: 'Đất ở',
    COMLAND: 'Đất thương mại',
    AGRLAND: 'Đất nông nghiệp',
    INDLAND: 'Đất công nghiệp',
};

export const getLocalizedPropertyCategoryName = (code: string | undefined, fallbackName: string) => {
    if (!code) return fallbackName;
    return CATEGORY_LABELS_VI[code] || fallbackName;
};
