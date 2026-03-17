import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { CreatePostDto } from './dto/post.dto';
import { MailProducerService } from '../../common/mail/mail-producer.service';
import { MailService } from '../../common/mail/mail.service';

@Injectable()
export class PostService {
    constructor(
        private prisma: PrismaService,
        private cloudinaryService: CloudinaryService,
        private mailProducer: MailProducerService,
        private mailService: MailService,
    ) { }

    async create(dto: CreatePostDto, userId: number, files?: Express.Multer.File[]) {
        const post = await this.prisma.post.create({
            data: {
                title: dto.title,
                city: dto.city,
                district: dto.district,
                ward: dto.ward,
                address: dto.address,
                description: dto.description,
                price: dto.price,
                area: dto.area,
                direction: dto.direction,
                status: 1,
                userId,
            },
        });

        if (files?.length) {
            const uploads = await this.cloudinaryService.uploadImages(files);
            await this.prisma.postImage.createMany({
                data: uploads.map((upload, index) => ({
                    url: upload.secure_url,
                    postId: post.id,
                    position: index + 1,
                })),
            });
        }

        const fullPost = await this.prisma.post.findUnique({
            where: { id: post.id },
            include: { images: { select: { id: true, url: true, position: true } } },
        });

        return { message: 'Post created and pending approval', data: fullPost };
    }

    async findApproved(page = 1, limit = 6) {
        const skip = (page - 1) * limit;
        const now = new Date();

        // Lấy tất cả posts với thông tin VIP
        const [allPosts, total] = await Promise.all([
            this.prisma.post.findMany({
                where: { status: 2 },
                include: {
                    user: { select: { id: true, username: true, fullName: true, phone: true } },
                    images: { select: { id: true, url: true, position: true } },
                    vipSubscriptions: {
                        where: {
                            status: 1, // active
                            endDate: { gte: now },
                        },
                        include: {
                            package: {
                                select: {
                                    name: true,
                                    priorityLevel: true,
                                },
                            },
                        },
                        orderBy: {
                            package: {
                                priorityLevel: 'desc',
                            },
                        },
                        take: 1, // Chỉ lấy VIP cao nhất
                    },
                },
                orderBy: { postedAt: 'desc' },
            }),
            this.prisma.post.count({ where: { status: 2 } }),
        ]);

        // Sắp xếp: VIP posts lên đầu (theo priority level), sau đó là các posts thường
        const sortedPosts = allPosts.sort((a, b) => {
            const aVip = a.vipSubscriptions?.[0];
            const bVip = b.vipSubscriptions?.[0];

            // Nếu cả 2 đều VIP, sort theo priority level
            if (aVip && bVip) {
                return bVip.package.priorityLevel - aVip.package.priorityLevel;
            }

            // Nếu chỉ a là VIP
            if (aVip) return -1;

            // Nếu chỉ b là VIP
            if (bVip) return 1;

            // Cả 2 đều không VIP, giữ nguyên thứ tự (đã sort by postedAt desc)
            return 0;
        });

        // Pagination
        const paginatedPosts = sortedPosts.slice(skip, skip + limit);

        // Format response - thêm isVip flag và ẩn vipSubscriptions khỏi response
        const formattedPosts = paginatedPosts.map(post => {
            const { vipSubscriptions, ...postData } = post;
            return {
                ...postData,
                isVip: vipSubscriptions?.length > 0,
                vipPackageName: vipSubscriptions?.[0]?.package?.name || null,
                vipPriorityLevel: vipSubscriptions?.[0]?.package?.priorityLevel || null,
            };
        });

        return {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            data: formattedPosts,
        };
    }

    async findPending() {
        return this.prisma.post.findMany({
            where: { status: 1 },
            include: {
                user: { select: { id: true, username: true, fullName: true, phone: true } },
                images: { select: { id: true, url: true, position: true } },
            },
        });
    }

    async findAll() {
        return this.prisma.post.findMany({
            include: {
                user: { select: { id: true, username: true, fullName: true, phone: true } },
                images: { select: { id: true, url: true, position: true } },
            },
            orderBy: { status: 'asc' },
        });
    }

    async findById(id: number) {
        const post = await this.prisma.post.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, username: true, fullName: true, phone: true } },
                images: { select: { id: true, url: true, position: true } },
            },
        });
        if (!post) throw new NotFoundException('Post not found');
        return post;
    }

    async approve(id: number) {
        const post = await this.prisma.post.findUnique({
            where: { id },
            include: { user: { select: { fullName: true, email: true } } },
        });
        if (!post) throw new NotFoundException('Post not found');

        const updated = await this.prisma.post.update({
            where: { id },
            data: { status: 2, approvedAt: new Date() },
        });

        if (post.user?.email) {
            const html = this.mailService.getPostApprovedEmailHtml(
                post.user.fullName || 'Quý khách',
                post.title,
            );
            this.mailProducer.sendMail(post.user.email, 'Bài đăng đã được duyệt', html);
        }

        return { message: 'Post approved', data: updated };
    }

    async reject(id: number) {
        const post = await this.prisma.post.findUnique({
            where: { id },
            include: { user: { select: { fullName: true, email: true } } },
        });
        if (!post) throw new NotFoundException('Post not found');

        const updated = await this.prisma.post.update({
            where: { id },
            data: { status: 3, approvedAt: new Date() },
        });

        if (post.user?.email) {
            const html = this.mailService.getPostRejectedEmailHtml(
                post.user.fullName || 'Quý khách',
                post.title,
            );
            this.mailProducer.sendMail(post.user.email, 'Bài đăng chưa được duyệt', html);
        }

        return { message: 'Post rejected', data: updated };
    }

    async delete(id: number) {
        const post = await this.prisma.post.findUnique({
            where: { id },
            include: { images: true },
        });
        if (!post) throw new NotFoundException('Post not found');

        if (post.images?.length) {
            await this.prisma.postImage.deleteMany({ where: { postId: id } });
        }

        await this.prisma.post.delete({ where: { id } });
        return { message: 'Post deleted successfully' };
    }

    async findByUser(userId: number) {
        return this.prisma.post.findMany({
            where: { userId },
            include: {
                images: { select: { id: true, url: true, position: true } },
            },
            orderBy: { postedAt: 'desc' },
        });
    }
}
