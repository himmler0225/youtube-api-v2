import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({
    description: "Username, email, or phone number",
    example: "john_doe",
  })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({
    description: "User password",
    example: "Password123",
  })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({
    description: "Unique device identifier (UUID v4)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsUUID("4")
  deviceId!: string;

  @ApiPropertyOptional({
    description: "Human-readable device name",
    example: "iPhone 14 Pro",
  })
  @IsString()
  @IsOptional()
  deviceName?: string;
}
