import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { favoriteApi } from '@/api';
import { PropertyCard } from '@/components/common';
import { Button } from '@/components/ui';
import type { Favorite, House } from '@/types';

const FavoriteManagementPage: React.FC = () => {
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadFavorites();
    }, []);

    const loadFavorites = async () => {
        setLoading(true);
        try {
            const res = await favoriteApi.getAll();
            setFavorites(res.data.data || res.data);
        } catch {
            toast.error('Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (fav: Favorite) => {
        try {
            if (fav.houseId) {
                await favoriteApi.removeHouse(fav.houseId);
            } else if (fav.landId) {
                await favoriteApi.removeLand(fav.landId);
            }
            toast.success('Đã bỏ yêu thích');
            loadFavorites();
        } catch {
            toast.error('Có lỗi xảy ra');
        }
    };

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Danh sách yêu thích</h3>

            {!loading && favorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-sm">Chưa có mục yêu thích nào</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {favorites.map((fav) => {
                        const property = fav.house || fav.land;
                        if (!property) return null;
                        return (
                            <div key={fav.id} className="relative">
                                <PropertyCard
                                    property={property as unknown as House}
                                    type={fav.houseId ? 'house' : 'land'}
                                />
                                <Button
                                    variant="danger"
                                    size="sm"
                                    iconOnly
                                    ariaLabel="Xóa"
                                    startIcon={(
                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    )}
                                    className="absolute top-2 right-2 z-10"
                                    onClick={() => {
                                        if (window.confirm('Bỏ yêu thích?')) handleRemove(fav);
                                    }}
                                >
                                    Xóa
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default FavoriteManagementPage;
