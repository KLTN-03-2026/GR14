import { useRef, useEffect } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    className?: string;
    showCloseButton?: boolean;
    footer?: React.ReactNode;
    width?: string;
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    className = '',
    showCloseButton = true,
    footer,
    width = 'max-w-lg',
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        if (isOpen) document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto">
            <div
                className="fixed inset-0 h-full w-full bg-gray-900/50 backdrop-blur-sm"
                onClick={onClose}
            />
            <div
                ref={modalRef}
                className={`relative w-full ${width} mx-4 rounded-2xl bg-white shadow-theme-lg ${className}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                {(title || showCloseButton) && (
                    <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                        {title && (
                            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                        )}
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <path
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                        d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                                        fill="currentColor"
                                    />
                                </svg>
                            </button>
                        )}
                    </div>
                )}

                {/* Body */}
                <div className="px-6 py-4">{children}</div>

                {/* Footer */}
                {footer && (
                    <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;
