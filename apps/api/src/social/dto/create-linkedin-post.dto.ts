import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

const VISIBILITIES = ['PUBLIC', 'CONNECTIONS'] as const;

export class CreateLinkedInPostDto {
  @IsString()
  @MinLength(1, { message: 'Post text is required' })
  @MaxLength(3000, { message: 'Post text must be 3000 characters or fewer' })
  commentary!: string;

  @IsIn(VISIBILITIES, { message: 'Visibility must be one of: PUBLIC, CONNECTIONS' })
  visibility!: (typeof VISIBILITIES)[number];
}
