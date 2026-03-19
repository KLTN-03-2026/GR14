import React, { useEffect, useState } from 'react';
import { Tabs, Spin, message, Empty, Button, Popconfirm } from 'antd';
import { HeartFilled, EnvironmentOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { favoriteApi } from '@/api'; 


const FavoritesPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [favoriteHouses, setFavoriteHouses] = useState<any[]>([]);
    const [favoriteLands, setFavoriteLands] = useState<any[]>([]);

    const fetchFavorites = async () => {
        setLoading(true);
        try {
            const res = await favoriteApi.getAll();
            const allFavorites = res.data; 

            const houses = allFavorites.filter((fav: any) => fav.house).map((fav: any) => fav.house);
            const lands = allFavorites.filter((fav: any) => fav.land).map((fav: any) => fav.land);

            setFavoriteHouses(houses);
            setFavoriteLands(lands);
        } catch (error) {
            message.error('Không thể tải danh sách yêu thích');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFavorites();
    }, []);

    const handleRemoveHouse = async (houseId: number) => {
        try {
            await favoriteApi.removeHouse(houseId);
            message.success('Đã bỏ yêu thích nhà này');
            setFavoriteHouses(prev => prev.filter(item => item.id !== houseId));
        } catch (error) {
            message.error('Có lỗi xảy ra khi bỏ yêu thích');
        }
    };

    const handleRemoveLand = async (landId: number) => {
        try {
            await favoriteApi.removeLand(landId);
            message.success('Đã bỏ yêu thích mảnh đất này');
            setFavoriteLands(prev => prev.filter(item => item.id !== landId));
        } catch (error) {
            message.error('Có lỗi xảy ra khi bỏ yêu thích');
        }
    };


    const PropertyCard = ({ item, type, onRemove }: { item: any, type: 'house' | 'land', onRemove: (id: number) => void }) => {
        const imageUrl = item.images && item.images.length > 0 
            ? item.images[0].url 
            : 'https://via.placeholder.com/400x300?text=No+Image';
        const detailLink = type === 'house' ? `/houses/${item.id}` : `/lands/${item.id}`;

        return (
            <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 group flex flex-col">
                <div className="relative h-48 overflow-hidden">
                    <img 
                        src={imageUrl} 
                        alt={item.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    />
                    <div className="absolute top-3 right-3">
                        <Popconfirm
                            title="Bạn có chắc chắn muốn bỏ lưu mục này?"
                            onConfirm={() => onRemove(item.id)}
                            okText="Đồng ý"
                            cancelText="Hủy"
                        >
                            <button className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 hover:scale-110 transition-all shadow-md">
                                <HeartFilled className="text-xl" />
                            </button>
                        </Popconfirm>
                    </div>
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-semibold">
                        {item.price ? `${item.price.toLocaleString()} VNĐ` : 'Thỏa thuận'}
                    </div>
                </div>
                
                <div className="p-4 flex-1 flex flex-col">
                    <Link to={detailLink} className="text-lg font-bold text-gray-800 hover:text-[#254b86] line-clamp-2 transition-colors">
                        {item.title}
                    </Link>
                    <div className="flex items-center text-gray-500 text-sm mt-2 mb-4">
                        <EnvironmentOutlined className="mr-1" />
                        <span className="truncate">{item.district}, {item.city}</span>
                    </div>
                    
                    <div className="mt-auto grid grid-cols-2 gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        <div><span className="font-semibold text-gray-800">{item.area}</span> m²</div>
                        {type === 'house' && <div><span className="font-semibold text-gray-800">{item.bedrooms || 0}</span> PN</div>}
                        {type === 'land' && <div><span className="font-semibold text-gray-800">{item.frontWidth || 0}</span>m mặt tiền</div>}
                    </div>
                </div>
            </div>
        );
    };


    const renderTabContent = (items: any[], type: 'house' | 'land') => {
        if (loading) return <div className="py-20 flex justify-center"><Spin size="large" /></div>;
        
        if (items.length === 0) {
            return (
                <Empty 
                    className="py-16"
                    description={<span className="text-gray-500 text-lg">Bạn chưa có mục yêu thích nào ở đây</span>}
                >
                    <Link to={type === 'house' ? '/houses' : '/lands'}>
                        <Button type="primary" className="bg-[#254b86] h-10 px-6 mt-4">Khám phá ngay</Button>
                    </Link>
                </Empty>
            );
        }

        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-4">
                {items.map(item => (
                    <PropertyCard 
                        key={item.id} 
                        item={item} 
                        type={type} 
                        onRemove={type === 'house' ? handleRemoveHouse : handleRemoveLand} 
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">

            <main className="flex-1 container mx-auto px-4 py-8 max-w-[1290px]">
                <div className="flex items-center gap-3 mb-8">
                    <HeartFilled className="text-3xl text-red-500" />
                    <h1 className="text-3xl font-bold text-gray-800 m-0">Danh Sách Yêu Thích</h1>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[500px]">
                    <Tabs 
                        defaultActiveKey="1" 
                        size="large"
                        items={[
                            { 
                                key: '1', 
                                label: <span className="font-semibold px-4">Nhà Đất ({favoriteHouses.length})</span>, 
                                children: renderTabContent(favoriteHouses, 'house') 
                            },
                            { 
                                key: '2', 
                                label: <span className="font-semibold px-4">Đất Đai ({favoriteLands.length})</span>, 
                                children: renderTabContent(favoriteLands, 'land') 
                            },
                        ]} 
                    />
                </div>
            </main>

        </div>
    );
};

export default FavoritesPage;