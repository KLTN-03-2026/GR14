import { useEffect } from 'react';

interface DetailDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    width?: string;
}

const DetailDrawer: React.FC<DetailDrawerProps> = ({
    isOpen,
    onClose,
    title,
    children,
    width = 'max-w-2xl',
}) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-[900] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Drawer panel */}
            <div
                className={`fixed top-0 right-0 z-[901] h-full ${width} w-full bg-white shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900 truncate pr-4">{title}</h2>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {children}
                </div>
            </div>
        </>
    );
};

export default DetailDrawer;
