import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { CreatePostDto, UpdatePostDto, PostType } from './dto/post.dto';
import { MailProducerService } from '../../common/mail/mail-producer.service';
import { MailService } from '../../common/mail/mail.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class PostService {
    constructor(
        private prisma: PrismaService,
        private cloudinaryService: CloudinaryService,
        private mailProducer: MailProducerService,
        private mailService: MailService,
        private aiService: AiService,
    ) { }

    private isVipSchemaMismatchError(error: unknown): boolean {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            // P2021: table does not exist, P2022: column does not exist
            return error.code === 'P2021' || error.code === 'P2022';
        }

        if (error instanceof Prisma.PrismaClientValidationError) {
            const msg = error.message.toLowerCase();
            return msg.includes('vipsubscriptions') || msg.includes('vip_subscriptions');
        }

        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            return msg.includes('vipsubscriptions') || msg.includes('vip_subscriptions');
        }

        return false;
    }

    private isAdminOrEmployee(roles?: string[]): boolean {
        if (!roles?.length) return false;
        return roles.includes('ADMIN') || roles.includes('EMPLOYEE');
    }

    private async shouldSendStatusEmail(userId: number): Promise<boolean> {
        const userRoles = await this.prisma.userRole.findMany({
            where: { userId },
            include: { role: { select: { code: true } } },
        });

        const roleCodes = userRoles.map((r) => r.role.code);
        return !this.isAdminOrEmployee(roleCodes);
    }

    private async resolveActorRoles(userId: number, actorRoles?: string[]): Promise<string[]> {
        if (actorRoles?.length) return actorRoles;

        const rows = await this.prisma.userRole.findMany({
            where: { userId },
            include: { role: { select: { code: true } } },
        });

        return rows.map((r) => r.role.code);
    }

    // Validate required fields based on post type
    private validatePostData(dto: CreatePostDto | UpdatePostDto): void {
        const { postType } = dto;

        // Validate based on post type
        switch (postType) {
            case PostType.SELL_HOUSE:
            case PostType.RENT_HOUSE:
            case PostType.SELL_LAND:
            case PostType.RENT_LAND:
                // BĐS requires: city, ward, address, price, area (district is optional)
                if (!dto.city || !dto.ward || !dto.address || !dto.price || !dto.area) {
                    throw new BadRequestException(
                        'BĐS yêu cầu: city, ward, address, price, area'
                    );
                }
                break;

            case PostType.NEED_BUY:
            case PostType.NEED_RENT:
                // NEED_BUY/NEED_RENT requires: city, minPrice, maxPrice, minArea, maxArea (district is optional)
                if (!dto.city || !dto.minPrice || !dto.maxPrice || !dto.minArea || !dto.maxArea) {
                    throw new BadRequestException(
                        'Tin cần mua/thuê yêu cầu: city, minPrice, maxPrice, minArea, maxArea'
                    );
                }
                // Validate min <= max
                if (dto.minPrice > dto.maxPrice) {
                    throw new BadRequestException('minPrice phải nhỏ hơn hoặc bằng maxPrice');
                }
                if (dto.minArea > dto.maxArea) {
                    throw new BadRequestException('minArea phải nhỏ hơn hoặc bằng maxArea');
                }
                break;

            case PostType.NEWS:
            case PostType.PROMOTION:
                // NEWS/PROMOTION only requires title and description (already validated by DTO)
                break;

            default:
                throw new BadRequestException('Loại bài đăng không hợp lệ');
        }
    }

    // Build data object based on post type
    private buildPostData(dto: CreatePostDto | UpdatePostDto, userId?: number): any {
        const { postType } = dto;
        const data: any = {
            postType,
            title: dto.title,
            contactPhone: dto.contactPhone,
            contactLink: dto.contactLink,
            description: dto.description,
        };

        // Add userId for create
        if (userId) {
            data.userId = userId;
            data.status = 1; // Default pending
        }

        // Add fields based on post type
        switch (postType) {
            case PostType.SELL_HOUSE:
            case PostType.RENT_HOUSE:
                // House posts
                data.city = dto.city;
                data.district = dto.district;
                data.ward = dto.ward;
                data.address = dto.address;
                data.price = dto.price ? Number(dto.price) : null;
                data.area = dto.area ? Number(dto.area) : null;
                data.direction = dto.direction;
                data.bedrooms = dto.bedrooms ?? 0;
                data.bathrooms = dto.bathrooms ?? 0;
                data.floors = dto.floors ?? 1;
                break;

            case PostType.SELL_LAND:
            case PostType.RENT_LAND:
                // Land posts
                data.city = dto.city;
                data.district = dto.district;
                data.ward = dto.ward;
                data.address = dto.address;
                data.price = dto.price ? Number(dto.price) : null;
                data.area = dto.area ? Number(dto.area) : null;
                data.direction = dto.direction;
                data.frontWidth = dto.frontWidth ? Number(dto.frontWidth) : null;
                data.landLength = dto.landLength ? Number(dto.landLength) : null;
                data.landType = dto.landType;
                data.legalStatus = dto.legalStatus;
                break;

            case PostType.NEED_BUY:
            case PostType.NEED_RENT:
                // Need buy/rent posts
                data.city = dto.city;
                data.district = dto.district;
                data.ward = dto.ward;
                data.address = dto.address;
                data.direction = dto.direction;
                data.minPrice = dto.minPrice ? Number(dto.minPrice) : null;
                data.maxPrice = dto.maxPrice ? Number(dto.maxPrice) : null;
                data.minArea = dto.minArea ? Number(dto.minArea) : null;
                data.maxArea = dto.maxArea ? Number(dto.maxArea) : null;
                break;

            case PostType.NEWS:
            case PostType.PROMOTION:
                // News/Promotion posts
                data.startDate = dto.startDate ? new Date(dto.startDate) : null;
                data.endDate = dto.endDate ? new Date(dto.endDate) : null;
                data.discountCode = dto.discountCode;
                break;
        }

        return data;
    }

    async create(dto: CreatePostDto, userId: number, files?: Express.Multer.File[], actorRoles?: string[]) {
        // Validate post data
        this.validatePostData(dto);

        // Build data based on post type
        const data = this.buildPostData(dto, userId);

        const resolvedRoles = await this.resolveActorRoles(userId, actorRoles);

        // Admin/Employee posts are auto-approved and should not trigger approval mail flow.
        if (this.isAdminOrEmployee(resolvedRoles)) {
            data.status = 2;
            data.approvedAt = new Date();
        }

        // Use transaction to ensure if image upload fails, Post is not created
        return this.prisma.$transaction(async (tx) => {
            const post = await tx.post.create({ data });

            if (files?.length) {
                const uploads = await this.cloudinaryService.uploadImages(files);
                await tx.postImage.createMany({
                    data: uploads.map((upload, index) => ({
                        url: upload.secure_url,
                        postId: post.id,
                        position: index + 1,
                    })),
                });
            }

            const createdPost = await tx.post.findUnique({
                where: { id: post.id },
                include: {
                    images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
                    user: { select: { id: true, username: true, fullName: true, phone: true } },
                },
            });

            if (data.status === 2) {
                this.aiService.indexOne('post', post.id).catch(() => { });
            }

            return createdPost;
        });
    }

    async findApproved(page = 1, limit = 6, postType?: PostType) {
        const skip = (page - 1) * limit;
        const now = new Date();

        // Build where clause
        const where: Record<string, unknown> = { status: 2 };
        if (postType) {
            where.postType = postType;
        }

        // Try VIP-aware query first; fallback to basic query if VIP tables/relations are unavailable.
        let formattedPosts: Record<string, unknown>[] = [];
        const total = await this.prisma.post.count({ where });

        try {
            const posts = await this.prisma.post.findMany({
                where,
                include: {
                    user: { select: { id: true, username: true, fullName: true, phone: true } },
                    images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
                    vipSubscriptions: {
                        where: { status: 1, endDate: { gte: now } },
                        include: { package: { select: { name: true, priorityLevel: true } } },
                        take: 1,
                    },
                },
                orderBy: [
                    { vipSubscriptions: { _count: 'desc' } },
                    { postedAt: 'desc' },
                ],
                skip,
                take: limit,
            });

            formattedPosts = posts.map((post) => {
                const vip = post.vipSubscriptions?.[0];
                return {
                    ...post,
                    isVip: !!vip,
                    vipPackageName: vip?.package?.name || null,
                    vipPriorityLevel: vip?.package?.priorityLevel || null,
                    vipSubscriptions: undefined,
                };
            });
        } catch (error) {
            if (!this.isVipSchemaMismatchError(error)) {
                throw error;
            }

            console.warn('VIP query unavailable in findApproved, fallback to basic query:', (error as Error).message);

            const posts = await this.prisma.post.findMany({
                where,
                include: {
                    user: { select: { id: true, username: true, fullName: true, phone: true } },
                    images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
                },
                orderBy: { postedAt: 'desc' },
                skip,
                take: limit,
            });

            formattedPosts = posts.map((post) => ({
                ...post,
                isVip: Boolean(post.isVip),
                vipPackageName: null,
                vipPriorityLevel: null,
            }));
        }

        return {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            data: formattedPosts,
        };
    }

    async findPending(postType?: PostType) {
        const where: Record<string, unknown> = { status: 1 };
        if (postType) {
            where.postType = postType;
        }

        return this.prisma.post.findMany({
            where,
            include: {
                user: { select: { id: true, username: true, fullName: true, phone: true } },
                images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
            },
            orderBy: { postedAt: 'desc' },
        });
    }

    async findAll(postType?: PostType) {
        const where: Record<string, unknown> = {};
        if (postType) {
            where.postType = postType;
        }

        try {
            const posts = await this.prisma.post.findMany({
                where,
                include: {
                    user: { select: { id: true, username: true, fullName: true, phone: true } },
                    images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
                    vipSubscriptions: {
                        include: {
                            package: { select: { name: true, priorityLevel: true, durationDays: true } },
                        },
                        orderBy: { endDate: 'desc' },
                        take: 1,
                    },
                },
                orderBy: { postedAt: 'desc' },
            });

            return posts.map((post) => {
                const vip = post.vipSubscriptions?.[0];
                return {
                    ...post,
                    isVip: Boolean(post.isVip || vip),
                    vipPackageName: vip?.package?.name || null,
                    vipPriorityLevel: vip?.package?.priorityLevel || null,
                    vipSubscriptionStatus: vip?.status ?? null,
                    vipExpiry: vip?.endDate || post.vipExpiry || null,
                    vipSubscriptions: undefined,
                };
            });
        } catch (error) {
            if (!this.isVipSchemaMismatchError(error)) {
                throw error;
            }

            console.warn('VIP query unavailable in findAll, fallback to basic query:', (error as Error).message);

            const posts = await this.prisma.post.findMany({
                where,
                include: {
                    user: { select: { id: true, username: true, fullName: true, phone: true } },
                    images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
                },
                orderBy: { postedAt: 'desc' },
            });

            return posts.map((post) => ({
                ...post,
                isVip: Boolean(post.isVip),
                vipPackageName: null,
                vipPriorityLevel: null,
                vipSubscriptionStatus: null,
                vipExpiry: post.vipExpiry || null,
            }));
        }
    }

    async findById(id: number) {
        const post = await this.prisma.post.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, username: true, fullName: true, phone: true } },
                images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
            },
        });
        if (!post) throw new NotFoundException('Không tìm thấy bài đăng');
        return post;
    }

    async approve(id: number) {
        const post = await this.prisma.post.findUnique({
            where: { id },
            include: { user: { select: { fullName: true, email: true } } },
        });
        if (!post) throw new NotFoundException('Bài đăng không tồn tại');

        const updated = await this.prisma.post.update({
            where: { id },
            data: { status: 2, approvedAt: new Date() },
        });

        const shouldSendEmail = await this.shouldSendStatusEmail(post.userId);
        if (post.user?.email && shouldSendEmail) {
            const html = this.mailService.getPostApprovedEmailHtml(post.user.fullName || 'Quý khách', post.title);
            this.mailProducer.sendMail(post.user.email, 'Bài đăng đã được duyệt', html);
        }

        // Trigger Qdrant indexing (fire-and-forget)
        this.aiService.indexOne('post', id).catch(() => { });

        return { message: 'Đã duyệt bài đăng', data: updated };
    }

    async reject(id: number) {
        const post = await this.prisma.post.findUnique({
            where: { id },
            include: { user: { select: { fullName: true, email: true } } },
        });
        if (!post) throw new NotFoundException('Bài đăng không tồn tại');

        const updated = await this.prisma.post.update({
            where: { id },
            data: { status: 3, approvedAt: new Date() },
        });

        const shouldSendEmail = await this.shouldSendStatusEmail(post.userId);
        if (post.user?.email && shouldSendEmail) {
            const html = this.mailService.getPostRejectedEmailHtml(post.user.fullName || 'Quý khách', post.title);
            this.mailProducer.sendMail(post.user.email, 'Bài đăng chưa được phê duyệt', html);
        }

        return { message: 'Đã từ chối bài đăng', data: updated };
    }

    async delete(id: number) {
        const post = await this.prisma.post.findUnique({ where: { id } });
        if (!post) throw new NotFoundException('Bài đăng không tồn tại');

        await this.prisma.$transaction(async (tx) => {
            // Delete related images first
            await tx.postImage.deleteMany({ where: { postId: id } });
            // Delete post
            await tx.post.delete({ where: { id } });
        });

        return { message: 'Xóa bài đăng thành công' };
    }

    async findByUser(userId: number, postType?: PostType) {
        const where: Record<string, unknown> = { userId };
        if (postType) {
            where.postType = postType;
        }

        return this.prisma.post.findMany({
            where,
            include: {
                images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
            },
            orderBy: { postedAt: 'desc' },
        });
    }

    async update(id: number, dto: UpdatePostDto, files?: Express.Multer.File[]) {
        const post = await this.prisma.post.findUnique({ where: { id } });
        if (!post) throw new NotFoundException('Không tìm thấy bài đăng');

        // Validate post data if postType is provided
        if (dto.postType) {
            this.validatePostData(dto as CreatePostDto);
        }

        // Build data based on post type
        const data = this.buildPostData(dto);

        return this.prisma.$transaction(async (tx) => {
            // Update text/number fields
            const updatedPost = await tx.post.update({
                where: { id },
                data,
            });

            // If new images are uploaded
            if (files && files.length > 0) {
                // Delete old images in DB
                await tx.postImage.deleteMany({ where: { postId: id } });

                const uploads = await this.cloudinaryService.uploadImages(files);
                await tx.postImage.createMany({
                    data: uploads.map((upload, index) => ({
                        url: upload.secure_url,
                        postId: id,
                        position: index + 1,
                    })),
                });
            }

            return tx.post.findUnique({
                where: { id },
                include: {
                    images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
                    user: { select: { id: true, username: true, fullName: true, phone: true } },
                },
            });
        });
    }
}
