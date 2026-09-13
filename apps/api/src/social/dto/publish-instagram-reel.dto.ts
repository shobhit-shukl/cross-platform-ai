import { IsString, MaxLength } from 'class-validator';

export class PublishInstagramReelDto {
  @IsString()
  @MaxLength(2200, { message: 'Caption must be 2200 characters or fewer' })
  caption!: string;
}
