import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({
    description: "Username (alphanumeric and underscore only)",
    example: "john_doe",
    minLength: 3,
    pattern: "^[a-zA-Z0-9_]+$",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9_]+$/)
  username!: string;

  @ApiPropertyOptional({
    description: "Email address",
    example: "john@example.com",
    format: "email",
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: "Phone number (10-11 digits)",
    example: "0123456789",
    pattern: "^[0-9]{10,11}$",
  })
  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{10,11}$/)
  phone?: string;

  @ApiProperty({
    description:
      "Password (min 8 characters, must contain lowercase, uppercase, and number)",
    example: "Password123",
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  password!: string;

  @ApiProperty({
    description: "Unique device identifier (UUID)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @ApiPropertyOptional({
    description: "Human-readable device name",
    example: "iPhone 14 Pro",
  })
  @IsString()
  @IsOptional()
  deviceName?: string;
}
