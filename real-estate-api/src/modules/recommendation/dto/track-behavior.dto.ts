import { IsEnum, IsOptional, IsInt } from 'class-validator';

export enum BehaviorAction {
  CLICK = 'click',
  SAVE = 'save',
}

export class TrackBehaviorDto {
  @IsEnum(BehaviorAction, {
    message: 'action phải là một trong: click, save',
  })
  action: BehaviorAction;

  @IsOptional()
  @IsInt({ message: 'houseId phải là số nguyên' })
  houseId?: number;

  @IsOptional()
  @IsInt({ message: 'landId phải là số nguyên' })
  landId?: number;
}
