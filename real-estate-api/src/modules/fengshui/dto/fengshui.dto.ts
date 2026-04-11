import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export enum CalendarType {
  SOLAR = 'solar', // Dương lịch
  LUNAR = 'lunar', // Âm lịch
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
}

export class FengshuiAnalyzeDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  birthDate!: string;

  @IsEnum(CalendarType)
  calendarType!: CalendarType;

  @IsEnum(Gender)
  gender!: Gender;

  @IsString()
  @IsOptional()
  location?: string;
}
