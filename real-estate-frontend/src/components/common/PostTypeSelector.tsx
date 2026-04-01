import React from 'react';
import { PostType, POST_TYPE_LABELS, POST_TYPE_GROUPS } from '@/types/post';

interface PostTypeSelectorProps {
    value: PostType | '';
    onChange: (value: PostType) => void;
    disabled?: boolean;
    showGroups?: boolean;
}

const PostTypeSelector: React.FC<PostTypeSelectorProps> = ({
    value,
    onChange,
    disabled = false,
    showGroups = true,
}) => {
    const postTypes = Object.values(PostType);

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
