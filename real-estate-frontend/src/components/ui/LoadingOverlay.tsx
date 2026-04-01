import React from 'react';

interface LoadingOverlayProps {
    visible: boolean;
    title?: string;
    description?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    visible,
    title = 'Đang xử lý...',
    description = 'Vui lòng đợi trong giây lát',
}) => {
    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[120000] flex items-center justify-center bg-gray-900/45 backdrop-blur-[1px]">
            <div className="w-[320px] rounded-2xl bg-white p-6 text-center shadow-2xl">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
                <h4 className="text-base font-semibold text-gray-900">{title}</h4>
                <p className="mt-1 text-sm text-gray-500">{description}</p>
            </div>
        </div>
    );
};

export default LoadingOverlay;
