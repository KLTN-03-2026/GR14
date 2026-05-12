import { useEffect, useState } from 'react';

/**
 * Trả về giá trị đã được debounce sau `delay` ms kể từ lần thay đổi cuối.
 * Dùng để tránh gọi API liên tục khi người dùng đang gõ.
 *
 * @param value  Giá trị cần debounce (thường là search string)
 * @param delay  Thời gian chờ tính bằng ms (mặc định 400ms)
 */
export function useDebounce<T>(value: T, delay = 400): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}
