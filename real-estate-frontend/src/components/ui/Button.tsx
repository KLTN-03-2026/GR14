import type { ReactNode } from 'react';

interface ButtonProps {
    children?: ReactNode;
    size?: 'sm' | 'md';
    variant?: 'primary' | 'outline' | 'danger' | 'link';
    startIcon?: ReactNode;
    endIcon?: ReactNode;
    iconOnly?: boolean;
    ariaLabel?: string;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
    className?: string;
    type?: 'button' | 'submit' | 'reset';
}

const Button: React.FC<ButtonProps> = ({
    children,
    size = 'md',
    variant = 'primary',
    startIcon,
    endIcon,
    iconOnly = false,
    ariaLabel,
    onClick,
    className = '',
    disabled = false,
    loading = false,
    type = 'button',
}) => {
    const sizeClasses: Record<'sm' | 'md', string> = {
        sm: 'h-9 px-3.5 text-xs',
        md: 'h-10 px-4 text-sm',
    };

    const iconOnlySizeClasses: Record<'sm' | 'md', string> = {
        sm: 'h-9 w-9 p-0 text-xs',
        md: 'h-10 w-10 p-0 text-sm',
    };

    const variantClasses = {
        primary:
            'bg-brand-500 text-white shadow-theme-sm hover:bg-brand-600 focus-visible:ring-4 focus-visible:ring-brand-100 disabled:bg-brand-300',
        outline:
            'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-4 focus-visible:ring-gray-100',
        danger:
            'bg-error-500 text-white shadow-theme-sm hover:bg-error-600 focus-visible:ring-4 focus-visible:ring-error-100 disabled:bg-error-300',
        link: 'text-brand-600 hover:text-brand-700 bg-transparent shadow-none h-auto px-0',
    };

    return (
        <button
            type={type}
            aria-label={ariaLabel}
            className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 ${iconOnly ? iconOnlySizeClasses[size] : sizeClasses[size]} ${variantClasses[variant]} ${disabled || loading ? 'cursor-not-allowed opacity-50' : ''
                } ${className}`}
            onClick={onClick}
            disabled={disabled || loading}
        >
            {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            )}
            {startIcon && !loading && <span className="flex items-center">{startIcon}</span>}
            {!iconOnly && children}
            {endIcon && <span className="flex items-center">{endIcon}</span>}
        </button>
    );
};

export default Button;
