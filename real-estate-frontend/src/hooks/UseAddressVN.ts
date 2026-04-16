import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';

export type VietnamProvince = {
    province_code: string;
    name: string;
};

export type VietnamWard = {
    ward_code: string;
    ward_name: string;
    province_code: string;
};

const VIETNAM_ADMIN_API_BASE = 'https://34tinhthanh.com/api';

export const useVietnamAddress = () => {
    const [provinces, setProvinces] = useState<VietnamProvince[]>([]);
    const [wards, setWards] = useState<VietnamWard[]>([]);

    // Load tất cả Tỉnh/Thành phố khi hook được mount
    useEffect(() => {
        fetch(`${VIETNAM_ADMIN_API_BASE}/provinces`)
            .then((res) => res.json())
            .then(data => setProvinces(data))
            .catch(() => message.error('Không thể tải danh sách tỉnh/thành phố'));
    }, []);

    const loadWards = useCallback((provinceName: string) => {
        const province = provinces.find((p) => p.name === provinceName);
        if (!province) {
            setWards([]);
            return;
        }

        fetch(`${VIETNAM_ADMIN_API_BASE}/wards?province_code=${province.province_code}`)
            .then((res) => res.json())
            .then((data) => setWards(data.wards || data || []))
            .catch(() => message.error('Không thể tải phường/xã'));
    }, [provinces]);

    const resetAddress = useCallback(() => {
        setWards([]);
    }, []);

    return {
        provinces,
        wards,
        loadWards,
        resetAddress
    };
};

