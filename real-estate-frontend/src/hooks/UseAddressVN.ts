import { useState, useEffect } from 'react';
import { message } from 'antd';

export const useVietnamAddress = () => {
    const [provinces, setProvinces] = useState<any[]>([]);
    const [districts, setDistricts] = useState<any[]>([]);
    const [wards, setWards] = useState<any[]>([]);

    // Load tất cả Tỉnh/Thành phố khi hook được mount
    useEffect(() => {
        fetch('https://provinces.open-api.vn/api/p/')
            .then(res => res.json())
            .then(data => setProvinces(data))
            .catch(() => message.error('Không thể tải danh sách tỉnh/thành phố'));
    }, []);

    const loadDistricts = (provinceName: string) => {
        const province = provinces.find(p => p.name === provinceName);
        if (!province) {
            setDistricts([]);
            setWards([]);
            return;
        }

        fetch(`https://provinces.open-api.vn/api/p/${province.code}?depth=2`)
            .then(res => res.json())
            .then(data => setDistricts(data.districts || []))
            .catch(() => message.error('Không thể tải quận/huyện'));
    };

    const loadWards = (districtName: string) => {
        const district = districts.find(d => d.name === districtName);
        if (!district) {
            setWards([]);
            return;
        }

        fetch(`https://provinces.open-api.vn/api/d/${district.code}?depth=2`)
            .then(res => res.json())
            .then(data => setWards(data.wards || []))
            .catch(() => message.error('Không thể tải phường/xã'));
    };

    const resetAddress = () => {
        setDistricts([]);
        setWards([]);
    };

    return {
        provinces,
        districts,
        wards,
        loadDistricts,
        loadWards,
        resetAddress
    };
};

