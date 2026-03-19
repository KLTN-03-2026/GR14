import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { RedisService } from '../../common/redis/redis.service';
import { CreateHouseDto, UpdateHouseDto } from './dto/house.dto';
import { validateFieldsNoSpecialChars } from '../../common/utils/validators';

// Cache TTL (seconds)
const HOUSE_LIST_TTL = 600;   // 10 minutes
const HOUSE_DETAIL_TTL = 900;  // 15 minutes
const HOUSE_SEARCH_TTL = 300;   // 5 minutes

const houseListKey = (page: number, limit: number) => `houses:list:${page}:${limit}`;
const houseDetailKey = (id: number) => `house:${id}`;
const houseSearchKey = (query: string, page: number, limit: number) => `houses:search:${query}:${page}:${limit}`;

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

        // Try cache first
        const cached = await this.redis.get(cacheKey).catch(() => null);
        if (cached) {
            this.logger.debug(`Cache HIT: ${cacheKey}`);
            return cached;
        }

        this.logger.debug(`Cache MISS: ${cacheKey}`);
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

        // Set cache
        await this.redis.set(cacheKey, result, HOUSE_LIST_TTL).catch(() => {
            this.logger.warn(`Failed to cache ${cacheKey}`);
        });

        return result;
    }

    async findById(id: number) {
        const cacheKey = houseDetailKey(id);

        // Try cache first
        const cached = await this.redis.get(cacheKey).catch(() => null);
        if (cached) {
            this.logger.debug(`Cache HIT: ${cacheKey}`);
            return cached;
        }

        this.logger.debug(`Cache MISS: ${cacheKey}`);
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

        // Set cache
        await this.redis.set(cacheKey, house, HOUSE_DETAIL_TTL).catch(() => {
            this.logger.warn(`Failed to cache ${cacheKey}`);
        });

        return house;
    }

    async create(dto: CreateHouseDto, files?: Express.Multer.File[]) {
        const fieldsToCheck = [dto.code, dto.title, dto.city, dto.district, dto.ward, dto.street, dto.houseNumber, dto.direction];
        if (validateFieldsNoSpecialChars(fieldsToCheck)) {
            throw new BadRequestException('Fields contain special characters');
        }

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

        // Invalidate cache
        await this.invalidateHouseCache();

        return {
            message: 'House created successfully',
            data: await this.findById(house.id),
        };
    }

    async update(id: number, dto: UpdateHouseDto, files?: Express.Multer.File[]) {
        const house = await this.prisma.house.findUnique({ where: { id } });
        if (!house) throw new NotFoundException('House not found');

        if (dto.code) {
            const existing = await this.prisma.house.findUnique({ where: { code: dto.code } });
            if (existing && existing.id !== id) throw new BadRequestException('House code already exists');
        }

        const fieldsToCheck = [dto.code, dto.title, dto.city, dto.district, dto.ward, dto.street, dto.houseNumber, dto.direction];
        if (validateFieldsNoSpecialChars(fieldsToCheck)) {
            throw new BadRequestException('Fields contain special characters');
        }

        await this.prisma.house.update({
            where: { id },
            data: {
                ...(dto.code && { code: dto.code }),
                ...(dto.title && { title: dto.title }),
                ...(dto.city !== undefined && { city: dto.city }),
                ...(dto.district !== undefined && { district: dto.district }),
                ...(dto.ward !== undefined && { ward: dto.ward }),
                ...(dto.street !== undefined && { street: dto.street }),
                ...(dto.houseNumber !== undefined && { houseNumber: dto.houseNumber }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.price !== undefined && { price: dto.price }),
                ...(dto.area !== undefined && { area: parseFloat(dto.area as any) }),
                ...(dto.direction !== undefined && { direction: dto.direction }),
                ...(dto.floors !== undefined && { floors: parseInt(dto.floors as any) }),
                ...(dto.bedrooms !== undefined && { bedrooms: parseInt(dto.bedrooms as any) }),
                ...(dto.bathrooms !== undefined && { bathrooms: parseInt(dto.bathrooms as any) }),
                ...(dto.status !== undefined && { status: dto.status }),
                ...(dto.categoryId !== undefined && { categoryId: dto.categoryId ? parseInt(dto.categoryId as any) : null }),
                ...(dto.employeeId !== undefined && { employeeId: dto.employeeId ? parseInt(dto.employeeId as any) : null }),
            },
        });

        if (files?.length || dto.keepImageIds !== undefined) {
            // Parse danh sách ID ảnh cần giữ
            const keepIds: number[] = dto.keepImageIds
                ? (Array.isArray(dto.keepImageIds) ? dto.keepImageIds : [dto.keepImageIds])
                    .map(Number).filter((n) => !isNaN(n))
                : [];

            // Xóa ảnh không nằm trong keepIds
            await this.prisma.houseImage.deleteMany({
                where: {
                    houseId: id,
                    ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
                },
            });

            // Upload và thêm ảnh mới
            if (files?.length) {
                const existingCount = await this.prisma.houseImage.count({ where: { houseId: id } });
                const uploads = await this.cloudinaryService.uploadImages(files);
                await this.prisma.houseImage.createMany({
                    data: uploads.map((upload, index) => ({
                        url: upload.secure_url,
                        houseId: id,
                        position: existingCount + index + 1,
                    })),
                });
            }
        }

        // Invalidate cache
        await this.invalidateHouseCache();
        await this.redis.del(houseDetailKey(id)).catch(() => { });

        return {
            message: 'House updated successfully',
            data: await this.findById(id),
        };
    }

    async delete(id: number) {
        const house = await this.prisma.house.findUnique({
            where: { id },
            include: { images: true },
        });
        if (!house) throw new NotFoundException('House not found');

        // Delete cloudinary images
        for (const img of house.images) {
            const publicId = img.url.split('/').pop()?.split('.')[0];
            if (publicId) await this.cloudinaryService.deleteImage(publicId);
        }

        await this.prisma.houseImage.deleteMany({ where: { houseId: id } });
        await this.prisma.house.delete({ where: { id } });

        // Invalidate cache
        await this.invalidateHouseCache();
        await this.redis.del(houseDetailKey(id)).catch(() => { });

        return { message: 'House deleted successfully' };
    }

    async search(query: string, page = 1, limit = 10) {
        const cacheKey = houseSearchKey(query, page, limit);

        // Try cache first
        const cached = await this.redis.get(cacheKey).catch(() => null);
        if (cached) {
            this.logger.debug(`Cache HIT: ${cacheKey}`);
            return cached;
        }

        this.logger.debug(`Cache MISS: ${cacheKey}`);
        const skip = (page - 1) * limit;
        const where = {
            OR: [
                { title: { contains: query } },
                { city: { contains: query } },
                { district: { contains: query } },
                { ward: { contains: query } },
                { description: { contains: query } },
            ],
        };

        const [houses, total] = await Promise.all([
            this.prisma.house.findMany({
                where,
                skip,
                take: limit,
                include: {
                    category: true,
                    images: { select: { url: true } },
                },
            }),
            this.prisma.house.count({ where }),
        ]);

        const result = {
            data: houses,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
        };

        // Set cache
        await this.redis.set(cacheKey, result, HOUSE_SEARCH_TTL).catch(() => {
            this.logger.warn(`Failed to cache ${cacheKey}`);
        });

        return result;
    }

    private async invalidateHouseCache(): Promise<void> {
        try {
            await this.redis.delByPattern('houses:list:*');
            await this.redis.delByPattern('houses:search:*');
            this.logger.debug('House cache invalidated');
        } catch (error) {
            this.logger.warn('Failed to invalidate house cache:', error);
        }
    }
}
