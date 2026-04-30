import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UserResponseDto {
  @ApiProperty({
    description: "User ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id!: string;

  @ApiProperty({ description: "Username", example: "john_doe" })
  username!: string;

  @ApiPropertyOptional({
    description: "Email address",
    example: "john@example.com",
  })
  email?: string;

  @ApiPropertyOptional({ description: "Phone number", example: "0123456789" })
  phone?: string;

  @ApiProperty({
    description: "User status",
    enum: ["ACTIVE", "BANNED", "DELETED"],
    example: "ACTIVE",
  })
  status!: string;

  @ApiPropertyOptional({ description: "Email verification timestamp" })
  emailVerifiedAt?: Date;

  @ApiPropertyOptional({ description: "Phone verification timestamp" })
  phoneVerifiedAt?: Date;

  @ApiProperty({ description: "Account creation timestamp" })
  createdAt!: Date;

  @ApiProperty({ description: "Last update timestamp" })
  updatedAt!: Date;
}

export class AuthResponseDto {
  @ApiProperty({ description: "JWT access token (expires in 15 minutes)" })
  accessToken!: string;

  @ApiProperty({ description: "Refresh token (expires in 30 days)" })
  refreshToken!: string;

  @ApiProperty({ description: "User information", type: UserResponseDto })
  user!: UserResponseDto;
}

export class RefreshResponseDto {
  @ApiProperty({ description: "New JWT access token (expires in 15 minutes)" })
  accessToken!: string;

  @ApiProperty({ description: "New refresh token (expires in 30 days)" })
  refreshToken!: string;
}

export class MessageResponseDto {
  @ApiProperty({
    description: "Response message",
    example: "Logged out successfully",
  })
  message!: string;
}

export class SessionDto {
  @ApiProperty({
    description: "Session ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id!: string;

  @ApiProperty({
    description: "Device identifier",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  deviceId!: string;

  @ApiPropertyOptional({
    description: "Human-readable device name",
    example: "iPhone 14 Pro",
  })
  deviceName?: string;

  @ApiProperty({ description: "Session creation time" })
  createdAt!: Date;

  @ApiPropertyOptional({ description: "Last activity time" })
  lastSeenAt?: Date;

  @ApiProperty({ description: "Refresh token expiry time" })
  refreshExpiresAt!: Date;

  @ApiProperty({ description: "Whether this is the current session" })
  isCurrent!: boolean;
}
