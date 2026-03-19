const FIELD_LABELS: Record<string, string> = {
    username: 'Tên đăng nhập',
    password: 'Mật khẩu',
    fullName: 'Họ tên',
    phone: 'Số điện thoại',
    email: 'Email',
    address: 'Địa chỉ',
    code: 'Mã',
    startDate: 'Ngày vào làm',
    status: 'Trạng thái',
    roleIds: 'Vai trò',
    name: 'Tên',
};

const STATIC_TRANSLATIONS: Record<string, string> = {
    'Username already exists': 'Tên đăng nhập đã tồn tại',
    'Email already exists': 'Email đã tồn tại',
    'User not found': 'Người dùng không tồn tại',
    'Employee not found': 'Nhân viên không tồn tại',
    'Customer not found': 'Khách hàng không tồn tại',
    'Property category not found': 'Loại bất động sản không tồn tại',
    'Category code already exists': 'Mã loại bất động sản đã tồn tại',
    'Current password is incorrect': 'Mật khẩu hiện tại không đúng',
    'Bad Request Exception': 'Dữ liệu không hợp lệ',
    'Forbidden resource': 'Bạn không có quyền thực hiện thao tác này',
    Unauthorized: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
    Forbidden: 'Bạn không có quyền thực hiện thao tác này',
};

const toFieldLabel = (field: string) => FIELD_LABELS[field] || field;

const translateDynamicMessage = (message: string): string => {
    const trimmed = message.trim();
    if (!trimmed) return '';

    if (STATIC_TRANSLATIONS[trimmed]) {
        return STATIC_TRANSLATIONS[trimmed];
    }

    const notEmptyMatch = trimmed.match(/^(.+) should not be empty$/i);
    if (notEmptyMatch) {
        return `${toFieldLabel(notEmptyMatch[1])} không được để trống`;
    }

    const stringMatch = trimmed.match(/^(.+) must be a string$/i);
    if (stringMatch) {
        return `${toFieldLabel(stringMatch[1])} phải là chuỗi`;
    }

    const emailMatch = trimmed.match(/^(.+) must be an email$/i);
    if (emailMatch) {
        return `${toFieldLabel(emailMatch[1])} không đúng định dạng`;
    }

    const integerMatch = trimmed.match(/^(.+) must be an integer number$/i);
    if (integerMatch) {
        return `${toFieldLabel(integerMatch[1])} phải là số nguyên`;
    }

    const arrayMatch = trimmed.match(/^(.+) must be an array$/i);
    if (arrayMatch) {
        return `${toFieldLabel(arrayMatch[1])} phải là danh sách`;
    }

    const numberEachMatch = trimmed.match(/^each value in (.+) must be an integer number$/i);
    if (numberEachMatch) {
        return `Mỗi giá trị trong ${toFieldLabel(numberEachMatch[1])} phải là số nguyên`;
    }

    return trimmed;
};

const extractMessages = (error: any): string[] => {
    const data = error?.response?.data;
    const rawMessage = data?.message ?? error?.message;

    if (Array.isArray(rawMessage)) {
        return rawMessage
            .map((m) => (typeof m === 'string' ? m : String(m)))
            .filter(Boolean);
    }

    if (typeof rawMessage === 'string' && rawMessage.trim()) {
        return [rawMessage.trim()];
    }

    return [];
};

export const getApiErrorMessage = (error: any, fallback = 'Có lỗi xảy ra, vui lòng thử lại'): string => {
    const messages = extractMessages(error);
    if (messages.length === 0) {
        return fallback;
    }

    const translated = [...new Set(messages.map(translateDynamicMessage).filter(Boolean))];
    return translated.length > 0 ? translated.join('\n') : fallback;
};
