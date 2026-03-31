import { useEffect, useMemo, useState } from 'react';

interface ImageLightboxProps {
    isOpen: boolean;
    images: string[];
    initialIndex?: number;
    onClose: () => void;
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({
    isOpen,
    images,
    initialIndex = 0,
    onClose,
}) => {
    const safeImages = useMemo(() => images.filter(Boolean), [images]);
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    useEffect(() => {
        if (!isOpen) return;
        setCurrentIndex(initialIndex);
    }, [isOpen, initialIndex]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') {
                setCurrentIndex((prev) => (prev - 1 + safeImages.length) % safeImages.length);
            }
            if (e.key === 'ArrowRight') {
                setCurrentIndex((prev) => (prev + 1) % safeImages.length);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, safeImages.length]);

    if (!isOpen || safeImages.length === 0) return null;

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
            <button
                type="button"
                onClick={onClose}
                className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Đóng xem ảnh"
            >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {safeImages.length > 1 && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setCurrentIndex((prev) => (prev - 1 + safeImages.length) % safeImages.length);
                    }}
                    className="absolute left-5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                    aria-label="Ảnh trước"
                >
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            )}

            <img
                src={safeImages[currentIndex]}
                alt="preview"
                className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain"
                onClick={(e) => e.stopPropagation()}
            />

            {safeImages.length > 1 && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setCurrentIndex((prev) => (prev + 1) % safeImages.length);
                    }}
                    className="absolute right-5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                    aria-label="Ảnh sau"
                >
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}
        </div>
    );
};

export default ImageLightbox;