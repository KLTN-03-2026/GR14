import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { favoriteApi } from '@/api';

interface FavoritesContextType {
    favoriteHouseIds: number[];
    favoriteLandIds: number[];
    isFavoritedHouse: (id: number) => boolean;
    isFavoritedLand: (id: number) => boolean;
    addHouseFavorite: (id: number) => Promise<void>;
    removeFavoritedHouse: (id: number) => Promise<void>;
    addLandFavorite: (id: number) => Promise<void>;
    removeFavoritedLand: (id: number) => Promise<void>;
    loading: boolean;
    refetch: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [favoriteHouseIds, setFavoriteHouseIds] = useState<number[]>([]);
    const [favoriteLandIds, setFavoriteLandIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchFavorites = async () => {
        try {
            const res = await favoriteApi.getAll();
            const allFavorites = res.data || [];

            const houseIds = allFavorites
                .filter((fav: any) => fav.house)
                .map((fav: any) => fav.house.id);

            const landIds = allFavorites
                .filter((fav: any) => fav.land)
                .map((fav: any) => fav.land.id);

            setFavoriteHouseIds(houseIds);
            setFavoriteLandIds(landIds);
        } catch (error) {
            console.error('Failed to fetch favorites:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFavorites();
    }, []);

    const isFavoritedHouse = (id: number) => favoriteHouseIds.includes(id);
    const isFavoritedLand = (id: number) => favoriteLandIds.includes(id);

    const addHouseFavorite = async (id: number) => {
        // Optimistic update
        setFavoriteHouseIds(prev => [...prev, id]);
        try {
            await favoriteApi.addHouse(id);
        } catch (error) {
            // Revert if API fails
            setFavoriteHouseIds(prev => prev.filter(hid => hid !== id));
            throw error;
        }
    };

    const removeFavoritedHouse = async (id: number) => {
        // Optimistic update
        setFavoriteHouseIds(prev => prev.filter(hid => hid !== id));
        try {
            await favoriteApi.removeHouse(id);
        } catch (error) {
            // Revert if API fails
            setFavoriteHouseIds(prev => [...prev, id]);
            throw error;
        }
    };

    const addLandFavorite = async (id: number) => {
        // Optimistic update
        setFavoriteLandIds(prev => [...prev, id]);
        try {
            await favoriteApi.addLand(id);
        } catch (error) {
            // Revert if API fails
            setFavoriteLandIds(prev => prev.filter(lid => lid !== id));
            throw error;
        }
    };

    const removeFavoritedLand = async (id: number) => {
        // Optimistic update
        setFavoriteLandIds(prev => prev.filter(lid => lid !== id));
        try {
            await favoriteApi.removeLand(id);
        } catch (error) {
            // Revert if API fails
            setFavoriteLandIds(prev => [...prev, id]);
            throw error;
        }
    };

    return (
        <FavoritesContext.Provider
            value={{
                favoriteHouseIds,
                favoriteLandIds,
                isFavoritedHouse,
                isFavoritedLand,
                addHouseFavorite,
                removeFavoritedHouse,
                addLandFavorite,
                removeFavoritedLand,
                loading,
                refetch: fetchFavorites,
            }}
        >
            {children}
        </FavoritesContext.Provider>
    );
};

export const useFavorites = () => {
    const context = useContext(FavoritesContext);
    if (!context) {
        throw new Error('useFavorites must be used within FavoritesProvider');
    }
    return context;
};
