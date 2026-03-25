import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
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
        // Dùng $transaction để đảm bảo nếu upload ảnh lỗi thì Post không được tạo
        return this.prisma.$transaction(async (tx) => {
            const post = await tx.post.create({
                data: {
                    title: dto.title,
                    city: dto.city,
                    district: dto.district,
                    ward: dto.ward,
                    address: dto.address,
                    description: dto.description,
                    price: Number(dto.price),
                    area: Number(dto.area),
                    direction: dto.direction,
                    status: 1, // Mặc định chờ duyệt
                    userId,
                },
            });

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

            return tx.post.findUnique({
                where: { id: post.id },
                include: { images: { select: { id: true, url: true, position: true } } },
            });
        });
    }

    async findApproved(page = 1, limit = 6) {
        const skip = (page - 1) * limit;
        const now = new Date();

        // Tối ưu: Phân trang trực tiếp dưới Database thay vì dùng .slice() của JS
        const [posts, total] = await Promise.all([
            this.prisma.post.findMany({
                where: { status: 2 },
                include: {
                    user: { select: { id: true, username: true, fullName: true, phone: true } },
                    images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
                    vipSubscriptions: {
                        where: { status: 1, endDate: { gte: now } },
                        include: { package: { select: { name: true, priorityLevel: true } } },
                        take: 1,
                    },
                },
                // Ưu tiên bài có VIP (số lượng subscription > 0) và ngày đăng mới nhất
                orderBy: [
                    { vipSubscriptions: { _count: 'desc' } },
                    { postedAt: 'desc' }
                ],
                skip,
                take: limit,
            }),
            this.prisma.post.count({ where: { status: 2 } }),
        ]);

        const formattedPosts = posts.map(post => {
            const vip = post.vipSubscriptions?.[0];
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
    }

    async findPending() {
        return this.prisma.post.findMany({
            where: { status: 1 },
            include: {
                user: { select: { id: true, username: true, fullName: true, phone: true } },
                images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
            },
            orderBy: { postedAt: 'desc' },
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

        if (post.user?.email) {
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

        if (post.user?.email) {
            const html = this.mailService.getPostRejectedEmailHtml(post.user.fullName || 'Quý khách', post.title);
            this.mailProducer.sendMail(post.user.email, 'Bài đăng chưa được phê duyệt', html);
        }

        return { message: 'Đã từ chối bài đăng', data: updated };
    }

    async delete(id: number) {
        const post = await this.prisma.post.findUnique({ where: { id } });
        if (!post) throw new NotFoundException('Bài đăng không tồn tại');

        return this.prisma.$transaction(async (tx) => {
            // Xóa ảnh liên quan trước
            await tx.postImage.deleteMany({ where: { postId: id } });
            // Xóa bài viết
            await tx.post.delete({ where: { id } });
        });

        return { message: 'Xóa bài đăng thành công' };
    }

    async findByUser(userId: number) {
        return this.prisma.post.findMany({
            where: { userId },
            include: {
                images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
            },
            orderBy: { postedAt: 'desc' },
        });
    }

    async update(id: number, dto: UpdatePostDto, files?: Express.Multer.File[]) {
        const post = await this.prisma.post.findUnique({ where: { id } });
        if (!post) throw new NotFoundException('Không tìm thấy bài đăng');

        return this.prisma.$transaction(async (tx) => {
            // Cập nhật các trường text/number
            const updatedPost = await tx.post.update({
                where: { id },
                data: {
                    title: dto.title,
                    city: dto.city,
                    district: dto.district,
                    ward: dto.ward,
                    address: dto.address,
                    description: dto.description,
                    direction: dto.direction,
                    price: dto.price ? Number(dto.price) : undefined,
                    area: dto.area ? Number(dto.area) : undefined,
                },
            });

            // Nếu có upload ảnh mới
            if (files && files.length > 0) {
                // Xóa list ảnh cũ trong DB
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