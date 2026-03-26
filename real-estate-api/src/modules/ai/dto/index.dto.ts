import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class IndexDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 200;
}
