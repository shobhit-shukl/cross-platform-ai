import { IsString, MaxLength } from 'class-validator';

export class PublishFacebookVideoDto {
  @IsString()
  @MaxLength(5000, { message: 'Caption must be 5000 characters or fewer' })
  caption!: string;
}
