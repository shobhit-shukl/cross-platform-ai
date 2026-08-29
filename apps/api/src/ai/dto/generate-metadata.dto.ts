import { IsString, MaxLength, MinLength } from 'class-validator';

export class GenerateMetadataDto {
  /** A short description of the video, e.g. "20s clip of my cat knocking a plant over". */
  @IsString()
  @MinLength(3, { message: 'Describe your video in a few words first' })
  @MaxLength(1000, { message: 'Description must be 1000 characters or fewer' })
  prompt!: string;
}
