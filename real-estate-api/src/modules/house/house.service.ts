import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { RedisService } from '../../common/redis/redis.service';
import { CreateHouseDto, UpdateHouseDto } from './dto/house.dto';
import { validateFieldsNoSpecialChars } from '../../common/utils/validators';

const HOUSE_LIST_TTL = 600;
const HOUSE_DETAIL_TTL = 900;
const HOUSE_SEARCH_TTL = 300;
const HOUSE_USER_TTL = 600;

const houseListKey = (page: number, limit: number) => `houses:list:${page}:${limit}`;
const houseDetailKey = (id: number) => `house:${id}`;
const houseSearchKey = (query: string, page: number, limit: number) => `houses:search:${query}:${page}:${limit}`;
const houseUserKey = (userId: number) => `houses:user:${userId}`;

@Injectable()
export class HouseService {
    private readonly logger = new Logger(HouseService.name);

    constructor(
        private prisma: PrismaService,
        private cloudinaryService: CloudinaryService,
        private redis: RedisService,
    ) { }

    async findAll(page = 1, limit = 10) {
        const cacheKey = houseListKey(page, limit);
        const cached = await this.redis.get(cacheKey).catch(() => null);
        if (cached) return cached;

        const skip = (page - 1) * limit;
        const [houses, total] = await Promise.all([
            this.prisma.house.findMany({
                skip,
                take: limit,
                include: {
                    category: true,
                    images: { select: { id: true, url: true } },
                    employee: {
                        include: { user: { select: { id: true, fullName: true, phone: true } } },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.house.count(),
        ]);

        const result = {
            data: houses,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
        };

        await this.redis.set(cacheKey, result, HOUSE_LIST_TTL).catch(() => { });
        return result;
    }

    async findByUser(userId: number) {
        const cacheKey = houseUserKey(userId);
        const cached = await this.redis.get(cacheKey).catch(() => null);
        if (cached) return cached;

        const houses = await this.prisma.house.findMany({
            where: { employee: { userId: userId } },
            include: {
                category: true,
                images: { select: { id: true, url: true } },
                employee: {
                    include: { user: { select: { id: true, fullName: true } } }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        await this.redis.set(cacheKey, houses, HOUSE_USER_TTL).catch(() => { });
        return houses;
    }

    async findById(id: number) {
        const cacheKey = houseDetailKey(id);
        const cached = await this.redis.get(cacheKey).catch(() => null);
        if (cached) return cached;

        const house = await this.prisma.house.findUnique({
            where: { id },
            include: {
                category: true,
                images: { select: { id: true, url: true } },
                employee: {
                    include: { user: { select: { id: true, fullName: true, phone: true } } },
                },
            },
        });
        if (!house) throw new NotFoundException('House not found');

        await this.redis.set(cacheKey, house, HOUSE_DETAIL_TTL).catch(() => { });
        return house;
    }

    async create(dto: CreateHouseDto, files?: Express.Multer.File[]) {
        const fieldsToCheck = [dto.code, dto.title, dto.city, dto.district, dto.ward, dto.street, dto.houseNumber, dto.direction];
        if (validateFieldsNoSpecialChars(fieldsToCheck)) throw new BadRequestException('Fields contain special characters');

        const existing = await this.prisma.house.findUnique({ where: { code: dto.code } });
        if (existing) throw new BadRequestException('House code already exists');

        const house = await this.prisma.house.create({
            data: {
                code: dto.code,
                title: dto.title,
                city: dto.city,
                district: dto.district,
                ward: dto.ward,
                street: dto.street,
                houseNumber: dto.houseNumber,
                description: dto.description,
                price: dto.price,
                area: dto.area ? parseFloat(dto.area as any) : null,
                direction: dto.direction,
                floors: dto.floors ? parseInt(dto.floors as any) : 1,
                bedrooms: dto.bedrooms ? parseInt(dto.bedrooms as any) : 0,
                bathrooms: dto.bathrooms ? parseInt(dto.bathrooms as any) : 0,
                status: 1,
                categoryId: dto.categoryId ? parseInt(dto.categoryId as any) : null,
                employeeId: dto.employeeId ? parseInt(dto.employeeId as any) : null,
            },
            include: { employee: true }
        });

        if (files?.length) {
            const uploads = await this.cloudinaryService.uploadImages(files);
            await this.prisma.houseImage.createMany({
                data: uploads.map((upload, index) => ({
                    url: upload.secure_url,
                    houseId: house.id,
                    position: index + 1,
                })),
            });
        }

        await this.invalidateHouseCache(house.employee?.userId);
        return { message: 'House created successfully', data: await this.findById(house.id) };
    }

    async update(id: number, dto: UpdateHouseDto, files?: Express.Multer.File[]) {
        const house = await this.prisma.house.findUnique({ 
            where: { id },
            include: { employee: true }
        });
        if (!house) throw new NotFoundException('House not found');

        await this.prisma.house.update({
            where: { id },
            data: {
                ...(dto.code && { code: dto.code }),
                ...(dto.title && { title: dto.title }),
                ...(dto.city !== undefined && { city: dto.city }),
                ...(dto.district !== undefined && { district: dto.district }),
                ...(dto.ward !== undefined && { ward: dto.ward }),
                ...(dto.street !== undefined && { street: dto.street }),
                ...(dto.price !== undefined && { price: dto.price }),
                ...(dto.status !== undefined && { status: dto.status }),
            },
        });

        if (files?.length) {
            const uploads = await this.cloudinaryService.uploadImages(files);
            await this.prisma.houseImage.createMany({
                data: uploads.map((upload, index) => ({
                    url: upload.secure_url,
                    houseId: id,
                    position: index + 1,
                })),
            });
        }

        await this.invalidateHouseCache(house.employee?.userId);
        await this.redis.del(houseDetailKey(id)).catch(() => { });

        return { message: 'House updated successfully', data: await this.findById(id) };
    }

    async delete(id: number) {
        const house = await this.prisma.house.findUnique({
            where: { id },
            include: { images: true, employee: true },
        });
        if (!house) throw new NotFoundException('House not found');

        for (const img of house.images) {
            const publicId = img.url.split('/').pop()?.split('.')[0];
            if (publicId) await this.cloudinaryService.deleteImage(publicId);
        }

        await this.prisma.houseImage.deleteMany({ where: { houseId: id } });
        await this.prisma.house.delete({ where: { id } });

        await this.invalidateHouseCache(house.employee?.userId);
        await this.redis.del(houseDetailKey(id)).catch(() => { });

        return { message: 'House deleted successfully' };
    }

    async search(query: string, page = 1, limit = 10) {
        const cacheKey = houseSearchKey(query, page, limit);
        const cached = await this.redis.get(cacheKey).catch(() => null);
        if (cached) return cached;

        const skip = (page - 1) * limit;
        const where = {
            OR: [
                { title: { contains: query } },
                { city: { contains: query } },
                { district: { contains: query } },
            ],
        };

        const [houses, total] = await Promise.all([
            this.prisma.house.findMany({
                where, skip, take: limit,
                include: { category: true, images: { select: { url: true } } },
            }),
            this.prisma.house.count({ where }),
        ]);

        const result = { data: houses, currentPage: page, totalPages: Math.ceil(total / limit), totalItems: total };
        await this.redis.set(cacheKey, result, HOUSE_SEARCH_TTL).catch(() => { });
        return result;
    }

    private async invalidateHouseCache(userId?: number): Promise<void> {
        try {
            await this.redis.delByPattern('houses:list:*');
            await this.redis.delByPattern('houses:search:*');
            if (userId) await this.redis.del(houseUserKey(userId));
        } catch (error) {
            this.logger.warn('Failed to invalidate cache', error);
        }
    }
}