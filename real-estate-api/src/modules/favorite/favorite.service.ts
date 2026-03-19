import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

// Cache TTL: 5 phút
const FAVORITES_TTL = 300;
const favoritesKey = (userId: number) => `favorites:${userId}`;

@Injectable()
export class FavoriteService {
    private readonly logger = new Logger(FavoriteService.name);

    constructor(
        private prisma: PrismaService,
        private redis: RedisService,
    ) {}

    async findByUser(userId: number) {
        const cacheKey = favoritesKey(userId);

        // 1. Thử lấy từ cache trước
        const cached = await this.redis.get(cacheKey);
        if (cached) {
            this.logger.debug(`Cache HIT: ${cacheKey}`);
            return cached;
        }

        // 2. Cache miss → query DB
        this.logger.debug(`Cache MISS: ${cacheKey}`);
        const data = await this.prisma.favorite.findMany({
            where: { userId },
            include: {
                house: {
                    include: { images: { select: { id: true, url: true } } },
                },
                land: {
                    include: { images: { select: { id: true, url: true } } },
                },
            },
        });

        // 3. Lưu vào cache
        await this.redis.set(cacheKey, data, FAVORITES_TTL);
        return data;
    }

    async addHouse(userId: number, houseId: number) {
        const house = await this.prisma.house.findUnique({ where: { id: houseId } });
        if (!house) throw new NotFoundException('House not found');

        const existing = await this.prisma.favorite.findFirst({
            where: { userId, houseId },
        });
        if (existing) throw new BadRequestException('Already in favorites');

        const favorite = await this.prisma.favorite.create({
            data: { userId, houseId },
        });

        // Invalidate cache sau khi thay đổi
        await this.invalidateCache(userId);

        return { message: 'Added to favorites', data: favorite };
    }

    async addLand(userId: number, landId: number) {
        const land = await this.prisma.land.findUnique({ where: { id: landId } });
        if (!land) throw new NotFoundException('Land not found');

        const existing = await this.prisma.favorite.findFirst({
            where: { userId, landId },
        });
        if (existing) throw new BadRequestException('Already in favorites');

        const favorite = await this.prisma.favorite.create({
            data: { userId, landId },
        });

        // Invalidate cache sau khi thay đổi
        await this.invalidateCache(userId);

        return { message: 'Added to favorites', data: favorite };
    }

    async removeHouse(userId: number, houseId: number) {
        const fav = await this.prisma.favorite.findFirst({ where: { userId, houseId } });
        if (!fav) throw new NotFoundException('Favorite not found');

        await this.prisma.favorite.delete({ where: { id: fav.id } });

        // Invalidate cache sau khi thay đổi
        await this.invalidateCache(userId);

        return { message: 'Removed from favorites' };
    }

    async removeLand(userId: number, landId: number) {
        const fav = await this.prisma.favorite.findFirst({ where: { userId, landId } });
        if (!fav) throw new NotFoundException('Favorite not found');

        await this.prisma.favorite.delete({ where: { id: fav.id } });

        // Invalidate cache sau khi thay đổi
        await this.invalidateCache(userId);

        return { message: 'Removed from favorites' };
    }

    private async invalidateCache(userId: number): Promise<void> {
        const cacheKey = favoritesKey(userId);
        await this.redis.del(cacheKey);
        this.logger.debug(`Cache INVALIDATED: ${cacheKey}`);
    }
}
