import { IsNotEmpty, IsString } from 'class-validator';

export class ChatDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  question!: string;
}
