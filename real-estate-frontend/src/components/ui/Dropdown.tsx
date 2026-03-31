import { useEffect, useRef } from 'react';

interface DropdownProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({ isOpen, onClose, children, className = '' }) => {
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                !(event.target as HTMLElement).closest('.dropdown-toggle')
            ) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={dropdownRef}
            className={`absolute z-50 right-0 mt-2 rounded-xl border border-gray-200 bg-white shadow-theme-lg ${className}`}
        >
            {children}
        </div>
    );
};

interface DropdownItemProps {
    onClick?: () => void;
    className?: string;
    children: React.ReactNode;
    danger?: boolean;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({ onClick, className = '', children, danger }) => {
    return (
        <button
            onClick={onClick}
            className={`block w-full text-left px-4 py-2.5 text-sm transition-colors ${
                danger
                    ? 'text-error-600 hover:bg-error-50'
                    : 'text-gray-700 hover:bg-gray-50'
            } ${className}`}
        >
            {children}
        </button>
    );
};
