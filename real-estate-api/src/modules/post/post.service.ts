import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { CreatePostDto, UpdatePostDto, PostType } from './dto/post.dto';
import { MailProducerService } from '../../common/mail/mail-producer.service';
import { MailService } from '../../common/mail/mail.service';

@Injectable()
export class PostService {
    constructor(
        private prisma: PrismaService,
        private cloudinaryService: CloudinaryService,
        private mailProducer: MailProducerService,
        private mailService: MailService,
    ) {}

    private isVipSchemaMismatchError(error: unknown): boolean {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
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

    private validatePostData(dto: CreatePostDto | UpdatePostDto): void {
        const { postType } = dto;

        switch (postType) {
            case PostType.SELL_HOUSE:
            case PostType.RENT_HOUSE:
            case PostType.SELL_LAND:
            case PostType.RENT_LAND:
                if (!dto.city || !dto.ward || !dto.address || !dto.price || !dto.area) {
                    throw new BadRequestException('BĐS yêu cầu: city, ward, address, price, area');
                }
                break;

            case PostType.NEED_BUY:
            case PostType.NEED_RENT:
                if (!dto.city || !dto.minPrice || !dto.maxPrice || !dto.minArea || !dto.maxArea) {
                    throw new BadRequestException('Tin cần mua/thuê yêu cầu: city, minPrice, maxPrice, minArea, maxArea');
                }
                if ((dto.minPrice ?? 0) > (dto.maxPrice ?? 0)) {
                    throw new BadRequestException('minPrice phải nhỏ hơn hoặc bằng maxPrice');
                }
                if ((dto.minArea ?? 0) > (dto.maxArea ?? 0)) {
                    throw new BadRequestException('minArea phải nhỏ hơn hoặc bằng maxArea');
                }
                break;

            case PostType.NEWS:
            case PostType.PROMOTION:
                break;

            default:
                throw new BadRequestException('Loại bài đăng không hợp lệ');
        }
    }

    private buildPostData(dto: CreatePostDto | UpdatePostDto, userId?: number): any {
        const { postType } = dto;
        const data: any = {
            postType,
            title: dto.title,
            contactPhone: dto.contactPhone,
            contactLink: dto.contactLink,
            description: dto.description,
        };

        if (userId) {
            data.userId = userId;
            data.status = 1;
        }

        switch (postType) {
            case PostType.SELL_HOUSE:
            case PostType.RENT_HOUSE:
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
                data.startDate = dto.startDate ? new Date(dto.startDate) : null;
                data.endDate = dto.endDate ? new Date(dto.endDate) : null;
                data.discountCode = dto.discountCode;
                break;
        }

        return data;
    }

    // ==================== CREATE ====================
    async create(dto: CreatePostDto, userId: number, files?: Express.Multer.File[], actorRoles?: string[]) {
        this.validatePostData(dto);

        const data = this.buildPostData(dto, userId);
        const resolvedRoles = await this.resolveActorRoles(userId, actorRoles);

        if (this.isAdminOrEmployee(resolvedRoles)) {
            data.status = 2;
            data.approvedAt = new Date();
        }

        return this.prisma.$transaction(async (tx) => {
            const post = await tx.post.create({ data });

            // Nếu user có VIP tài khoản còn hạn (ACCOUNT_VIP) thì gắn VIP cho bài đăng này
            // Quy ước tier: 30 ngày → VIP 3, 15 ngày → VIP 2, 7 ngày → VIP 1 (theo priorityLevel của package)
            // Lưu ý: vipSubscription cho account có postId = null; ta tạo thêm 1 bản ghi cho post để admin UI hiển thị đúng gói VIP.
            if (!this.isAdminOrEmployee(resolvedRoles)) {
                const now = new Date();
                const activeAccountVip = await tx.vipSubscription.findFirst({
                    where: {
                        userId,
                        postId: null,
                        status: 1,
                        endDate: { gt: now },
                    },
                    include: { package: true },
                    orderBy: { endDate: 'desc' },
                });

                if (activeAccountVip?.endDate && activeAccountVip.packageId) {
                    await tx.post.update({
                        where: { id: post.id },
                        data: ({
                            isVip: true,
                            vipExpiry: activeAccountVip.endDate,
                            vipPriorityLevel: activeAccountVip.package?.priorityLevel ?? 0,
                        } as any),
                    });

                    await tx.vipSubscription.create({
                        data: {
                            postId: post.id,
                            packageId: activeAccountVip.packageId,
                            userId,
                            status: 1,
                            startDate: now,
                            endDate: activeAccountVip.endDate,
                        },
                    });
                }
            }

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
                    vipSubscriptions: {
                        include: { package: { select: { name: true, priorityLevel: true } } },
                        orderBy: { endDate: 'desc' },
                        take: 1,
                    },
                },
            });

            return createdPost;
        });
    }

    // ==================== FIND ALL (Admin) - ĐÃ SỬA ĐỂ KHỚP VỚI CONTROLLER ====================
    // ==================== FIND ALL (Admin) ====================
    async findAll(query: {
        page?: number;
        limit?: number;
        status?: number;
        search?: string;
        postType?: PostType;
    }) {
        const { page = 1, limit = 10, status, search, postType } = query;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (status !== undefined) {
            where.status = Number(status);
        } else {
            where.status = { not: 0 };
        }

        if (postType) {
            where.postType = postType;
        }

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        try {
            const [posts, total] = await Promise.all([
                this.prisma.post.findMany({
                    where,
                    include: {
                        user: { select: { id: true, username: true, fullName: true, phone: true } },
                        images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
                        vipSubscriptions: {
                            include: { package: { select: { name: true, priorityLevel: true } } },
                            orderBy: { endDate: 'desc' },
                            take: 1,
                        },
                    },
                    orderBy: ([
                        { vipPriorityLevel: 'desc' },
                        { postedAt: 'desc' },
                    ] as any),
                    skip,
                    take: Number(limit),
                }),
                this.prisma.post.count({ where }),
            ]);

            const formattedPosts = posts.map((post) => {
                const vip = (post as any).vipSubscriptions?.[0];
                return {
                    ...post,
                    isVip: Boolean(post.isVip || vip),
                    vipPackageName: vip?.package?.name || null,
                    vipPriorityLevel: vip?.package?.priorityLevel || null,
                    vipSubscriptions: undefined,
                };
            });

            return {
                currentPage: Number(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                data: formattedPosts,
            };
        } catch (error) {
            if (!this.isVipSchemaMismatchError(error)) throw error;

            console.warn('VIP query unavailable, using basic query');

            const [posts, total] = await Promise.all([
                this.prisma.post.findMany({
                    where,
                    include: {
                        user: { select: { id: true, username: true, fullName: true, phone: true } },
                        images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
                    },
                    // Fallback khi DB thiếu các cột VIP (vip_priority_level / vip_subscriptions...)
                    orderBy: { postedAt: 'desc' },
                    skip,
                    take: Number(limit),
                }),
                this.prisma.post.count({ where }),
            ]);

            const formattedPosts = posts.map((post) => ({
                ...post,
                isVip: Boolean(post.isVip),
                vipPackageName: null,
                vipPriorityLevel: null,
            }));

            return {
                currentPage: Number(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                data: formattedPosts,
            };
        }
    }

    async findApproved(page = 1, limit = 6, postType?: PostType) {
        const skip = (page - 1) * limit;
        const where: any = { status: 2 };
        if (postType) where.postType = postType;

        const total = await this.prisma.post.count({ where });

        try {
            const posts = await this.prisma.post.findMany({
                where,
                include: {
                    user: { select: { id: true, username: true, fullName: true, phone: true } },
                    images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
                    vipSubscriptions: {
                        where: { status: 1, endDate: { gte: new Date() } },
                        include: { package: { select: { name: true, priorityLevel: true } } },
                        take: 1,
                    },
                },
                orderBy: ([
                    { vipPriorityLevel: 'desc' },
                    { postedAt: 'desc' },
                ] as any),
                skip,
                take: limit,
            });

            const formattedPosts = posts.map((post) => {
                const vip = (post as any).vipSubscriptions?.[0];
                return {
                    ...post,
                    isVip: !!vip,
                    vipPackageName: vip?.package?.name || null,
                    vipPriorityLevel: vip?.package?.priorityLevel || null,
                    vipSubscriptions: undefined,
                };
            });

            return {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                data: formattedPosts,
            };
        } catch (error) {
            if (!this.isVipSchemaMismatchError(error)) throw error;

            console.warn('VIP query unavailable, using basic query');

            const posts = await this.prisma.post.findMany({
                where,
                include: {
                    user: { select: { id: true, username: true, fullName: true, phone: true } },
                    images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
                },
                // Fallback khi DB thiếu các cột VIP (vip_priority_level / vip_subscriptions...)
                orderBy: { postedAt: 'desc' },
                skip,
                take: limit,
            });

            const formattedPosts = posts.map((post) => ({
                ...post,
                isVip: Boolean(post.isVip),
                vipPackageName: null,
                vipPriorityLevel: null,
            }));

            return {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                data: formattedPosts,
            };
        }
    }

    async findPending(postType?: PostType) {
        const where: any = { status: 1 };
        if (postType) where.postType = postType;

        return this.prisma.post.findMany({
            where,
            include: {
                user: { select: { id: true, username: true, fullName: true, phone: true } },
                images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
            },
            orderBy: ([
                { vipPriorityLevel: 'desc' },
                { postedAt: 'desc' },
            ] as any),
        });
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

    async findByUser(userId: number, postType?: PostType) {
        const where: any = { userId };
        if (postType) where.postType = postType;

        return this.prisma.post.findMany({
            where,
            include: {
                images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
            },
            orderBy: ([
                { vipPriorityLevel: 'desc' },
                { postedAt: 'desc' },
            ] as any),
        });
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

    async update(id: number, dto: UpdatePostDto, userId: number, files?: Express.Multer.File[]) {
        const post = await this.prisma.post.findUnique({ where: { id } });
        if (!post) throw new NotFoundException('Không tìm thấy bài đăng');

        if (post.userId !== userId) {
            throw new ForbiddenException('Bạn không có quyền chỉnh sửa bài đăng này');
        }

        if (dto.postType) {
            this.validatePostData(dto as CreatePostDto);
        }

        const data = this.buildPostData(dto);

        return this.prisma.$transaction(async (tx) => {
            await tx.post.update({
                where: { id },
                data,
            });

            if (files && files.length > 0) {
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

    async delete(id: number, userId: number) {
        const post = await this.prisma.post.findUnique({ where: { id } });
        if (!post) throw new NotFoundException('Bài đăng không tồn tại');

        if (post.userId !== userId) {
            throw new ForbiddenException('Bạn không có quyền xóa bài đăng này');
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.postImage.deleteMany({ where: { postId: id } });
            await tx.post.delete({ where: { id } });
        });

        return { message: 'Xóa bài đăng thành công' };
    }
}