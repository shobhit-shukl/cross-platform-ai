import { IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(1, { message: 'Title is required' })
  @MaxLength(200, { message: 'Title must be 200 characters or fewer' })
  summary!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Description must be 5000 characters or fewer' })
  description?: string;

  @IsISO8601({ strict: true }, { message: 'startDateTime must be a valid ISO 8601 datetime' })
  startDateTime!: string;

  @IsISO8601({ strict: true }, { message: 'endDateTime must be a valid ISO 8601 datetime' })
  endDateTime!: string;
}
