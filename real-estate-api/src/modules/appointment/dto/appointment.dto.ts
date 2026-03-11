import { IsNotEmpty, IsOptional, IsInt, IsString, IsEmail, ValidateIf } from 'class-validator';

export class CreateAppointmentDto {
    @IsOptional()
    @IsInt()
    houseId?: number;

    @IsOptional()
    @IsInt()
    landId?: number;

    @IsNotEmpty()
    @IsString()
    appointmentDate: string;
}

export class AdminCreateAppointmentDto {
    @IsOptional()
    @IsInt()
    houseId?: number;

    @IsOptional()
    @IsInt()
    landId?: number;

    // --- Option A: chọn khách hàng có sẵn ---
    @IsOptional()
    @IsInt()
    customerId?: number;

    // --- Option B: tạo khách hàng mới ---
    @IsOptional()
    @IsString()
    newCustomerName?: string;

    @IsOptional()
    @IsString()
    newCustomerPhone?: string;

    @IsOptional()
    @ValidateIf((o) => !!o.newCustomerEmail)
    @IsEmail()
    newCustomerEmail?: string;

    @IsOptional()
    @IsInt()
    employeeId?: number;

    @IsNotEmpty()
    @IsString()
    appointmentDate: string;
}

export class UpdateAppointmentDto {
    @IsOptional()
    @IsString()
    appointmentDate?: string;

    @IsOptional()
    @IsInt()
    employeeId?: number;

    @IsOptional()
    @IsInt()
    status?: number;
}

export class ApproveAppointmentDto {
    @IsNotEmpty()
    @IsInt()
    employeeId: number;
}

export class CancelAppointmentDto {
    @IsOptional()
    @IsString()
    cancelReason?: string;
}

export class AssignEmployeeDto {
    @IsNotEmpty()
    @IsInt()
    employeeId: number;
}

export class UpdateActualStatusDto {
    @IsNotEmpty()
    @IsInt()
    actualStatus: number;

    @IsOptional()
    @IsString()
    cancelReason?: string;
}
