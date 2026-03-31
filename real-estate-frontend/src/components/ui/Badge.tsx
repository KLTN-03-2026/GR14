type BadgeColor = 'primary' | 'success' | 'error' | 'warning' | 'info' | 'light' | 'dark';

interface BadgeProps {
    color?: BadgeColor;
    children: React.ReactNode;
    className?: string;
}

const colorClasses: Record<BadgeColor, string> = {
    primary: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200/80',
    success: 'bg-success-50 text-success-700 ring-1 ring-success-200/80',
    error: 'bg-error-50 text-error-700 ring-1 ring-error-200/80',
    warning: 'bg-warning-50 text-warning-700 ring-1 ring-warning-200/80',
    info: 'bg-blue-light-50 text-blue-light-700 ring-1 ring-blue-light-200/80',
    light: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200/80',
    dark: 'bg-gray-500 text-white',
};

const Badge: React.FC<BadgeProps> = ({ color = 'primary', children, className = '' }) => {
    return (
        <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold leading-none ${colorClasses[color]} ${className}`}
        >
            {children}
        </span>
    );
};

export default Badge;
