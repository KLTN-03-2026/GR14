import React from 'react';
import { PostType, POST_TYPE_LABELS, POST_TYPE_GROUPS } from '@/types/post';

interface PostTypeSelectorProps {
    value: PostType | '';
    onChange: (value: PostType) => void;
    disabled?: boolean;
    showGroups?: boolean;
    mode?: 'select' | 'cards';
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const Icons = {
    SellHouse: () => (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 3l9 6.75V21a.75.75 0 01-.75.75H15v-6h-6v6H3.75A.75.75 0 013 21V9.75z" />
        </svg>
    ),
    SellLand: () => (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497z" />
        </svg>
    ),
    RentHouse: () => (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
        </svg>
    ),
    RentLand: () => (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
    ),
    NeedBuy: () => (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
    ),
    NeedRent: () => (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    News: () => (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
        </svg>
    ),
    Promotion: () => (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
        </svg>
    ),
    Check: () => (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
        </svg>
    ),
};

// ─── Type Metadata ────────────────────────────────────────────────────────────

type TypeMeta = {
    label: string;
    description: string;
    icon: React.FC;
    accent: string;       // active border + icon bg colour
    iconColor: string;    // icon stroke colour (inactive)
    badge: string;        // badge bg (active)
};

const TYPE_META: Record<PostType, TypeMeta> = {
    [PostType.SELL_HOUSE]: {
        label: 'Bán nhà',
        description: 'Nhà, căn hộ, nhà phố',
        icon: Icons.SellHouse,
        accent: 'from-rose-500 to-orange-500',
        iconColor: 'text-rose-500',
        badge: 'bg-rose-500',
    },
    [PostType.SELL_LAND]: {
        label: 'Bán đất',
        description: 'Đất nền, đất dự án',
        icon: Icons.SellLand,
        accent: 'from-amber-500 to-yellow-500',
        iconColor: 'text-amber-500',
        badge: 'bg-amber-500',
    },
    [PostType.RENT_HOUSE]: {
        label: 'Cho thuê nhà',
        description: 'Nhà, căn hộ, phòng trọ',
        icon: Icons.RentHouse,
        accent: 'from-blue-500 to-cyan-500',
        iconColor: 'text-blue-500',
        badge: 'bg-blue-500',
    },
    [PostType.RENT_LAND]: {
        label: 'Cho thuê đất',
        description: 'Mặt bằng, kho bãi',
        icon: Icons.RentLand,
        accent: 'from-indigo-500 to-sky-500',
        iconColor: 'text-indigo-500',
        badge: 'bg-indigo-500',
    },
    [PostType.NEED_BUY]: {
        label: 'Cần mua',
        description: 'Tìm mua bất động sản',
        icon: Icons.NeedBuy,
        accent: 'from-emerald-500 to-teal-500',
        iconColor: 'text-emerald-500',
        badge: 'bg-emerald-500',
    },
    [PostType.NEED_RENT]: {
        label: 'Cần thuê',
        description: 'Tìm thuê bất động sản',
        icon: Icons.NeedRent,
        accent: 'from-teal-500 to-cyan-500',
        iconColor: 'text-teal-500',
        badge: 'bg-teal-500',
    },
    [PostType.NEWS]: {
        label: 'Tin tức',
        description: 'Tin thị trường bất động sản',
        icon: Icons.News,
        accent: 'from-violet-500 to-purple-500',
        iconColor: 'text-violet-500',
        badge: 'bg-violet-500',
    },
    [PostType.PROMOTION]: {
        label: 'Khuyến mãi',
        description: 'Ưu đãi, chương trình giảm giá',
        icon: Icons.Promotion,
        accent: 'from-pink-500 to-rose-500',
        iconColor: 'text-pink-500',
        badge: 'bg-pink-500',
    },
};

const GROUP_META = {
    property: { title: 'Bất động sản', emoji: '🏠', helper: 'Tin bán & cho thuê nhà/đất' },
    need:     { title: 'Cần mua / Cần thuê', emoji: '🔍', helper: 'Đăng nhu cầu tìm kiếm' },
    content:  { title: 'Nội dung', emoji: '📝', helper: 'Tin tức & chương trình ưu đãi' },
};

// ─── Component ────────────────────────────────────────────────────────────────

const PostTypeSelector: React.FC<PostTypeSelectorProps> = ({
    value,
    onChange,
    disabled = false,
    showGroups = true,
    mode = 'select',
}) => {
    const postTypes = Object.values(PostType);

    if (mode === 'cards') {
        const renderCard = (type: PostType) => {
            const selected = value === type;
            const meta = TYPE_META[type];
            const IconComponent = meta.icon;

            return (
                <button
                    key={type}
                    type="button"
                    onClick={() => onChange(type)}
                    disabled={disabled}
                    className={`
                        group relative flex items-center gap-3.5 rounded-xl border p-3.5
                        text-left transition-all duration-200 select-none
                        ${selected
                            ? 'border-transparent bg-white shadow-md ring-2 ring-offset-1'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }
                        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                    `}
                    style={selected ? { ringColor: 'var(--tw-ring-color)' } : undefined}
                >
                    {/* Coloured ring when selected */}
                    {selected && (
                        <span
                            className={`absolute inset-0 rounded-xl bg-gradient-to-r ${meta.accent} opacity-[0.07]`}
                            aria-hidden
                        />
                    )}

                    {/* Icon pill */}
                    <div className={`
                        relative shrink-0 flex h-10 w-10 items-center justify-center rounded-lg
                        transition-all duration-200
                        ${selected
                            ? `bg-gradient-to-br ${meta.accent} text-white shadow-sm`
                            : `bg-gray-100 ${meta.iconColor} group-hover:bg-gray-200`
                        }
                    `}>
                        <IconComponent />
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold leading-tight ${selected ? 'text-gray-900' : 'text-gray-700'}`}>
                            {meta.label}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gray-400">{meta.description}</p>
                    </div>

                    {/* Check badge */}
                    <div className={`
                        shrink-0 flex h-5 w-5 items-center justify-center rounded-full
                        transition-all duration-200
                        ${selected
                            ? `${meta.badge} text-white scale-100 opacity-100`
                            : 'scale-75 opacity-0'
                        }
                    `}>
                        <Icons.Check />
                    </div>
                </button>
            );
        };

        const renderGroup = (
            groupKey: 'property' | 'need' | 'content',
            types: readonly PostType[],
        ) => {
            const g = GROUP_META[groupKey];
            return (
                <div key={groupKey} className="space-y-2">
                    <div className="flex items-center gap-2 pb-1">
                        <span className="text-base leading-none">{g.emoji}</span>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                                {g.title}
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {types.map((type) => renderCard(type))}
                    </div>
                </div>
            );
        };

        return (
            <div className="space-y-1">
                {/* Header */}
                <div className="mb-3 flex items-baseline gap-2">
                    <p className="text-sm font-semibold text-gray-800">
                        Loại bài đăng <span className="text-red-500">*</span>
                    </p>
                    <span className="text-xs text-gray-400">— Chọn 1 loại phù hợp</span>
                </div>

                {/* Groups */}
                <div className="space-y-5">
                    {renderGroup('property', POST_TYPE_GROUPS.PROPERTY)}
                    <div className="border-t border-dashed border-gray-100" />
                    {renderGroup('need', POST_TYPE_GROUPS.NEED)}
                    <div className="border-t border-dashed border-gray-100" />
                    {renderGroup('content', POST_TYPE_GROUPS.CONTENT)}
                </div>
            </div>
        );
    }

    // ── Fallback: select mode ─────────────────────────────────────────────────
    if (!showGroups) {
        return (
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as PostType)}
                disabled={disabled}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
                <option value="">-- Chọn loại bài đăng --</option>
                {postTypes.map((type) => (
                    <option key={type} value={type}>
                        {POST_TYPE_LABELS[type]}
                    </option>
                ))}
            </select>
        );
    }

    return (
        <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">
                Loại bài đăng <span className="text-red-500">*</span>
            </label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as PostType)}
                disabled={disabled}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
                <option value="">-- Chọn loại bài đăng --</option>

                <optgroup label="Bất động sản">
                    {POST_TYPE_GROUPS.PROPERTY.map((type) => (
                        <option key={type} value={type}>
                            {POST_TYPE_LABELS[type]}
                        </option>
                    ))}
                </optgroup>

                <optgroup label="Cần mua/thuê">
                    {POST_TYPE_GROUPS.NEED.map((type) => (
                        <option key={type} value={type}>
                            {POST_TYPE_LABELS[type]}
                        </option>
                    ))}
                </optgroup>

                <optgroup label="Nội dung">
                    {POST_TYPE_GROUPS.CONTENT.map((type) => (
                        <option key={type} value={type}>
                            {POST_TYPE_LABELS[type]}
                        </option>
                    ))}
                </optgroup>
            </select>
        </div>
    );
};

export default PostTypeSelector;
