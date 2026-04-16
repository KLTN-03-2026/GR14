import {
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsString,
  IsEmail,
  ValidateIf,
  IsIn,
  IsDateString,
} from 'class-validator';

export class CreateAppointmentDto {
  @IsOptional()
  @IsInt()
  houseId?: number;

  @IsOptional()
  @IsInt()
  landId?: number;

  @IsNotEmpty()
  @IsString()
  appointmentDate!: string;

  @IsOptional()
  @IsInt()
  durationMinutes?: number;
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
  appointmentDate!: string;

  @IsOptional()
  @IsInt()
  durationMinutes?: number;
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

  @IsOptional()
  @IsInt()
  durationMinutes?: number;
}

export class ApproveAppointmentDto {
  @IsNotEmpty()
  @IsInt()
  employeeId!: number;
}

export class CancelAppointmentDto {
  @IsOptional()
  @IsString()
  cancelReason?: string;
}

export class AssignEmployeeDto {
  @IsNotEmpty()
  @IsInt()
  employeeId!: number;
}

export class UpdateActualStatusDto {
  @IsNotEmpty()
  @IsInt()
  @IsIn([0, 1, 2, 3]) // 0: chưa gặp, 1: đã gặp, 2: khách không đến, 3: không thể thực hiện
  actualStatus!: number;

  @IsOptional()
  @IsString()
  cancelReason?: string;
}

export class MarkFirstContactDto {
  @IsOptional()
  @IsDateString()
  firstContactAt?: string;
}

export class AppointmentCalendarQueryDto {
  @IsNotEmpty()
  @IsString()
  start!: string;

  @IsNotEmpty()
  @IsString()
  end!: string;

  @IsOptional()
  @IsString()
  employeeId?: string;
}

export class MoveCalendarAppointmentDto {
  @IsNotEmpty()
  @IsString()
  appointmentDate!: string;

  @IsOptional()
  @IsInt()
  employeeId?: number;
}
