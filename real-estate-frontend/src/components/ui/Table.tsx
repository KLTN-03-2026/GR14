import type { ReactNode } from 'react';

type BivariantRender<T> = {
    bivarianceHack(value: unknown, record: T, index: number): ReactNode;
}['bivarianceHack'];

// ---- Primitive table wrappers ----
interface TableProps { children: ReactNode; className?: string }
interface TableHeaderProps { children: ReactNode; className?: string }
interface TableBodyProps { children: ReactNode; className?: string }
interface TableRowProps { children: ReactNode; className?: string }
interface TableCellProps { children: ReactNode; isHeader?: boolean; className?: string }

export const Table: React.FC<TableProps> = ({ children, className = '' }) => (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className={`min-w-full divide-y divide-gray-200 ${className}`}>{children}</table>
    </div>
);

export const TableHeader: React.FC<TableHeaderProps> = ({ children, className = '' }) => (
    <thead className={`bg-gray-50 ${className}`}>{children}</thead>
);

export const TableBody: React.FC<TableBodyProps> = ({ children, className = '' }) => (
    <tbody className={`divide-y divide-gray-200 bg-white ${className}`}>{children}</tbody>
);

export const TableRow: React.FC<TableRowProps> = ({ children, className = '' }) => (
    <tr className={`hover:bg-gray-50 transition-colors ${className}`}>{children}</tr>
);

export const TableCell: React.FC<TableCellProps> = ({ children, isHeader = false, className = '' }) => {
    const Tag = isHeader ? 'th' : 'td';
    const base = isHeader
        ? 'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider'
        : 'px-4 py-3 text-sm text-gray-700 whitespace-nowrap';
    return <Tag className={`${base} ${className}`}>{children}</Tag>;
};

// ---- High-level DataTable ----
export interface Column<T> {
    title: string;
    dataIndex?: string;
    key?: string;
    width?: number | string;
    ellipsis?: boolean;
    render?: BivariantRender<T>;
}

interface DataTableProps<T extends object> {
    columns: Column<T>[];
    dataSource: T[];
    rowKey: keyof T & string;
    loading?: boolean;
    onRow?: (record: T) => { onClick?: () => void; style?: React.CSSProperties; className?: string };
    pagination?: {
        current: number;
        total: number;
        pageSize: number;
        onChange: (page: number) => void;
        showTotal?: (total: number) => string;
    } | false;
}

export function DataTable<T extends object>({
    columns,
    dataSource,
    rowKey,
    loading = false,
    onRow,
    pagination,
}: DataTableProps<T>) {
    const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 0;
    const minTableWidth = columns.reduce<number>((acc, col) => {
        if (typeof col.width === 'number') return acc + col.width;
        return acc;
    }, 0);

    const getNestedValue = (obj: unknown, path: string): unknown => {
        return path
            .split('.')
            .reduce<unknown>((acc, part) => (acc as Record<string, unknown> | undefined)?.[part], obj);
    };

    return (
        <div className="admin-form-surface p-0">
            {/* 
              Bọc cả table + pagination trong 1 vùng scroll ngang.
              Thanh scroll sẽ nằm ở cuối cùng của khối (dưới pagination).
            */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <div style={minTableWidth ? { minWidth: `${minTableWidth}px` } : undefined}>
                <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/80">
                        <tr>
                            {columns.map((col, i) => (
                                <th
                                    key={col.key || col.dataIndex || i}
                                    className="px-4 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em] whitespace-nowrap"
                                    style={col.width ? { width: typeof col.width === 'number' ? `${col.width}px` : col.width } : undefined}
                                >
                                    {col.title}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-14 text-center">
                                    <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-500">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        <span>Đang tải dữ liệu</span>
                                    </div>
                                </td>
                            </tr>
                        ) : dataSource.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-14 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2 text-gray-400">
                                        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                        </svg>
                                        <span className="text-sm">Không có dữ liệu phù hợp</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            dataSource.map((record, rowIdx) => {
                                const rowProps = onRow?.(record) ?? {};
                                return (
                                <tr
                                    key={record[rowKey] as React.Key}
                                    className={`hover:bg-brand-25/40 transition-colors ${rowProps.onClick ? 'cursor-pointer' : ''} ${rowProps.className ?? ''}`}
                                    style={rowProps.style}
                                    onClick={rowProps.onClick}
                                >
                                    {columns.map((col, colIdx) => {
                                        let cellContent: ReactNode | undefined;
                                        const dataIndex = col.dataIndex;

                                        if (col.render) {
                                            const value = dataIndex
                                                ? (Array.isArray(dataIndex)
                                                    ? getNestedValue(record, dataIndex.join('.'))
                                                    : getNestedValue(record, dataIndex))
                                                : undefined;
                                            cellContent = col.render(value, record, rowIdx);
                                        } else if (dataIndex) {
                                            cellContent = (Array.isArray(dataIndex)
                                                ? getNestedValue(record, dataIndex.join('.'))
                                                : getNestedValue(record, dataIndex)) as ReactNode;
                                        }

                                        return (
                                            <td
                                                key={col.key || (Array.isArray(dataIndex) ? dataIndex.join('.') : dataIndex) || colIdx}
                                                className={`px-4 py-3.5 text-sm text-gray-700 ${col.ellipsis ? 'truncate max-w-[200px]' : ''}`}
                                                style={col.width ? { width: typeof col.width === 'number' ? `${col.width}px` : col.width } : undefined}
                                            >
                                                {cellContent ?? '—'}
                                            </td>
                                        );
                                    })}
                                </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                {/* Pagination */}
                {pagination && pagination.total > 0 && (
                    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 bg-white">
                        <div className="text-sm text-gray-500">
                            {pagination.showTotal
                                ? pagination.showTotal(pagination.total)
                                : `Tổng ${pagination.total} bản ghi`}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => pagination.onChange(pagination.current - 1)}
                                disabled={pagination.current <= 1}
                                className="h-9 px-3 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Trước
                            </button>
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                let pageNum: number;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (pagination.current <= 3) {
                                    pageNum = i + 1;
                                } else if (pagination.current >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = pagination.current - 2 + i;
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => pagination.onChange(pageNum)}
                                        className={`h-9 min-w-9 px-3 text-sm rounded-lg border ${pagination.current === pageNum
                                            ? 'bg-brand-500 text-white border-brand-500'
                                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => pagination.onChange(pagination.current + 1)}
                                disabled={pagination.current >= totalPages}
                                className="h-9 px-3 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Sau
                            </button>
                        </div>
                    </div>
                )}
                </div>
            </div>

        </div>
    );
}
