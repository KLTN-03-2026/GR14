import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class EstimateValuationDto {
  @IsString()
  @IsNotEmpty()
  provinceName: string;

  @IsString()
  @IsNotEmpty()
  districtName: string;

  @IsString()
  @IsNotEmpty()
  propertyTypeName: string;

  @IsNumber()
  @Min(1)
  area: number;

  @IsNumber()
  @Min(0)
  bedroomCount: number;

  @IsNumber()
  @Min(0)
  bathroomCount: number;

  @IsNumber()
  @Min(0)
  floors: number;

  @IsNumber()
  @Min(0)
  frontWidth: number;

  @IsString()
  direction: string;

  @IsString()
  legalStatus: string;
}
