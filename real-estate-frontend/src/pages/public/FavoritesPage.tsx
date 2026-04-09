import React, { useEffect, useState, useMemo } from 'react';
import { Tabs, Spin, Empty, Button } from 'antd';
import { HeartFilled } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { favoriteApi } from '@/api';
import { useFavorites } from '@/context/FavoritesContext';
import { PropertyCard } from '@/components/common';

const FavoritesPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [allHouses, setAllHouses] = useState<any[]>([]);
    const [allLands, setAllLands] = useState<any[]>([]);
    const { favoriteHouseIds, favoriteLandIds } = useFavorites();

    const fetchFavorites = async () => {
        setLoading(true);
        try {
            const res = await favoriteApi.getAll();
            const allFavorites = res.data;
            setAllHouses(allFavorites.filter((fav: any) => fav.house).map((fav: any) => fav.house));
            setAllLands(allFavorites.filter((fav: any) => fav.land).map((fav: any) => fav.land));
        } catch {
            // message handled by interceptor
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchFavorites(); }, []);

    // Filter items dựa trên IDs từ FavoritesContext (auto update when user unfavorite)
    const favoriteHouses = useMemo(
        () => allHouses.filter(house => favoriteHouseIds.includes(house.id)),
        [allHouses, favoriteHouseIds]
    );

    const favoriteLands = useMemo(
        () => allLands.filter(land => favoriteLandIds.includes(land.id)),
        [allLands, favoriteLandIds]
    );

    const renderTabContent = (items: any[], type: 'house' | 'land') => {
        if (loading) {
            return (
                <div className="py-20 flex justify-center">
                    <Spin size="large" />
                </div>
            );
        }

        if (items.length === 0) {
            return (
                <Empty
                    className="py-16"
                    description={<span className="text-gray-500 text-lg">Bạn chưa có mục yêu thích nào ở đây</span>}
                >
                    <Link to={type === 'house' ? '/houses' : '/lands'}>
                        <Button type="primary" className="bg-[#254b86] h-10 px-6 mt-4">
                            Khám phá ngay
                        </Button>
                    </Link>
                </Empty>
            );
        }

        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-4">
                {items.map((item) => (
                    <PropertyCard
                        key={item.id}
                        property={item}
                        type={type}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <main className="flex-1 container mx-auto px-4 py-8 max-w-[1290px]">

                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <HeartFilled className="text-3xl text-red-500" />
                    <h1 className="text-3xl font-bold text-gray-800 m-0">Danh Sách Yêu Thích</h1>
                </div>

                {/* Tabs */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[500px]">
                    <Tabs
                        defaultActiveKey="1"
                        size="large"
                        items={[
                            {
                                key: '1',
                                label: <span className="font-semibold px-4">Nhà Đất ({favoriteHouses.length})</span>,
                                children: renderTabContent(favoriteHouses, 'house'),
                            },
                            {
                                key: '2',
                                label: <span className="font-semibold px-4">Đất Đai ({favoriteLands.length})</span>,
                                children: renderTabContent(favoriteLands, 'land'),
                            },
                        ]}
                    />
                </div>

            </main>
        </div>
    );
};

export default FavoritesPage;