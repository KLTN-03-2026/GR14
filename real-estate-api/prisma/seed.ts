import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // Create roles
    const adminRole = await prisma.role.upsert({
        where: { code: 'ADMIN' },
        update: {},
        create: { code: 'ADMIN', name: 'Administrator', description: 'Full system access' },
    });

    const employeeRole = await prisma.role.upsert({
        where: { code: 'EMPLOYEE' },
        update: {},
        create: { code: 'EMPLOYEE', name: 'Employee', description: 'Staff member' },
    });

    const customerRole = await prisma.role.upsert({
        where: { code: 'CUSTOMER' },
        update: {},
        create: { code: 'CUSTOMER', name: 'Customer', description: 'Regular customer' },
    });

    // Create admin user
    const hashPass = await bcrypt.hash('admin123', 10);
    const adminUser = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            password: hashPass,
            fullName: 'System Admin',
            email: 'admin@realestate.com',
            phone: '0123456789',
            status: 1,
        },
    });

    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
        update: {},
        create: { userId: adminUser.id, roleId: adminRole.id },
    });

    // Create property categories
    const categories = [
        { code: 'HOUSE', name: 'House' },
        { code: 'VILLA', name: 'Villa' },
        { code: 'APARTMENT', name: 'Apartment' },
        { code: 'TOWNHOUSE', name: 'Townhouse' },
        { code: 'RESLAND', name: 'Residential Land' },
        { code: 'COMLAND', name: 'Commercial Land' },
        { code: 'AGRLAND', name: 'Agricultural Land' },
        { code: 'INDLAND', name: 'Industrial Land' },
    ];

    for (const cat of categories) {
        await prisma.propertyCategory.upsert({
            where: { code: cat.code },
            update: {},
            create: cat,
        });
    }

    // Create VIP packages
    const vipPackages = [
        {
            name: 'VIP 7 ngày',
            description: 'Gói VIP 7 ngày - Tin đăng được ưu tiên hiển thị',
            durationDays: 7,
            price: 100000,
            priorityLevel: 1,
            features: JSON.stringify({
                highlight: true,
                topPost: true,
                badge: 'VIP 7',
            }),
        },
        {
            name: 'VIP 15 ngày',
            description: 'Gói VIP 15 ngày - Tin đăng được ưu tiên cao',
            durationDays: 15,
            price: 180000,
            priorityLevel: 2,
            features: JSON.stringify({
                highlight: true,
                topPost: true,
                badge: 'VIP 15',
                featured: true,
            }),
        },
        {
            name: 'VIP 30 ngày',
            description: 'Gói VIP 30 ngày - Ưu tiên cao nhất',
            durationDays: 30,
            price: 300000,
            priorityLevel: 3,
            features: JSON.stringify({
                highlight: true,
                topPost: true,
                badge: 'VIP 30',
                featured: true,
                urgent: true,
            }),
        },
    ];

    for (const pkg of vipPackages) {
        const existing = await prisma.vipPackage.findFirst({
            where: { name: pkg.name },
        });

        if (!existing) {
            await prisma.vipPackage.create({
                data: pkg,
            });
        }
    }

    // Create employees
    const employeeData = [
        { username: 'emp01', fullName: 'Nguyễn Văn An', email: 'nvan.an@realestate.com', phone: '0901111001', code: 'EMP001' },
        { username: 'emp02', fullName: 'Trần Thị Bảo', email: 'tthi.bao@realestate.com', phone: '0901111002', code: 'EMP002' },
        { username: 'emp03', fullName: 'Lê Minh Cường', email: 'lm.cuong@realestate.com', phone: '0901111003', code: 'EMP003' },
    ];

    for (const emp of employeeData) {
        const hashPassEmp = await bcrypt.hash('employee123', 10);
        const empUser = await prisma.user.upsert({
            where: { username: emp.username },
            update: {},
            create: {
                username: emp.username,
                password: hashPassEmp,
                fullName: emp.fullName,
                email: emp.email,
                phone: emp.phone,
                status: 1,
            },
        });

        await prisma.userRole.upsert({
            where: { userId_roleId: { userId: empUser.id, roleId: employeeRole.id } },
            update: {},
            create: { userId: empUser.id, roleId: employeeRole.id },
        });

        await prisma.employee.upsert({
            where: { code: emp.code },
            update: {},
            create: {
                code: emp.code,
                userId: empUser.id,
                startDate: new Date('2024-01-01'),
            },
        });
    }

    // Create customers
    const customerData = [
        { username: 'cus01', fullName: 'Phạm Thị Dung', email: 'pthi.dung@gmail.com', phone: '0912221001', code: 'CUS001' },
        { username: 'cus02', fullName: 'Hoàng Văn Em', email: 'hvan.em@gmail.com', phone: '0912221002', code: 'CUS002' },
        { username: 'cus03', fullName: 'Vũ Thị Phương', email: 'vthi.phuong@gmail.com', phone: '0912221003', code: 'CUS003' },
    ];

    for (const cus of customerData) {
        const hashPassCus = await bcrypt.hash('customer123', 10);
        const cusUser = await prisma.user.upsert({
            where: { username: cus.username },
            update: {},
            create: {
                username: cus.username,
                password: hashPassCus,
                fullName: cus.fullName,
                email: cus.email,
                phone: cus.phone,
                status: 1,
            },
        });

        await prisma.userRole.upsert({
            where: { userId_roleId: { userId: cusUser.id, roleId: customerRole.id } },
            update: {},
            create: { userId: cusUser.id, roleId: customerRole.id },
        });

        await prisma.customer.upsert({
            where: { code: cus.code },
            update: {},
            create: {
                code: cus.code,
                userId: cusUser.id,
            },
        });
    }

    console.log('Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
