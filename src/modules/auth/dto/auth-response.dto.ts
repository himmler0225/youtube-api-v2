import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Username',
    example: 'john_doe',
  })
  username: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john@example.com',
  })
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '0123456789',
  })
  phone?: string;

  @ApiProperty({
    description: 'User status',
    enum: ['ACTIVE', 'BANNED', 'DELETED'],
    example: 'ACTIVE',
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Email verification timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  emailVerifiedAt?: Date;

  @ApiPropertyOptional({
    description: 'Phone verification timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  phoneVerifiedAt?: Date;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token (expires in 15 minutes)',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NSIsInNlc3Npb25JZCI6IjY3ODkwIiwidiI6MCwiaWF0IjoxNzA1MzE0MDAwLCJleHAiOjE3MDUzMTQ5MDB9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Refresh token (expires in 30 days)',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'User information',
    type: UserResponseDto,
  })
  user: UserResponseDto;
}

export class RefreshResponseDto {
  @ApiProperty({
    description: 'New JWT access token (expires in 15 minutes)',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NSIsInNlc3Npb25JZCI6IjY3ODkwIiwidiI6MCwiaWF0IjoxNzA1MzE0MDAwLCJleHAiOjE3MDUzMTQ5MDB9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  })
  accessToken: string;

  @ApiProperty({
    description: 'New refresh token (expires in 30 days)',
    example: 'z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1',
  })
  refreshToken: string;
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Logged out successfully',
  })
  message: string;
}
