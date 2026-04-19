# YouTube API - Development Guide

## 📋 Tổng Quan Project

Đây là một REST API backend được xây dựng bằng **NestJS** với các tính năng:
- ✅ Authentication & Authorization (JWT + Passport)
- ✅ Database ORM (Prisma + PostgreSQL)
- ✅ Error Handling toàn cục
- ✅ Logging với redaction
- ✅ Request tracking (requestId)
- ✅ Response transformation
- ✅ Type-safe với TypeScript strict mode

---

## 📁 Cấu Trúc Project

```
youtube-api/
├── src/
│   ├── base/                    # Core infrastructure
│   │   ├── errors/             # Error codes & custom exceptions
│   │   │   ├── error-code.ts
│   │   │   ├── error-messages.ts
│   │   │   └── app.exception.ts
│   │   ├── filters/            # Exception filters
│   │   │   └── all-exceptions.filter.ts
│   │   ├── http/               # HTTP response types
│   │   │   └── api-response.ts
│   │   ├── interceptors/       # Response interceptors
│   │   │   └── response.interceptor.ts
│   │   ├── logger/             # Logging service
│   │   │   ├── app-logger.service.ts
│   │   │   └── redact.ts
│   │   └── middleware/         # Request middleware
│   │       └── request-context.middleware.ts
│   │
│   ├── modules/                # Feature modules
│   │   ├── auth/              # Authentication module
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.module.ts
│   │   │   └── dto/           # DTOs cho auth
│   │   └── prisma/            # Prisma module
│   │       ├── prisma.service.ts
│   │       └── prisma.module.ts
│   │
│   ├── common/                 # Shared utilities (trống - dành cho tương lai)
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── pipes/
│   │   ├── dto/
│   │   └── interfaces/
│   │
│   ├── app.module.ts          # Root module
│   └── main.ts                # Entry point
│
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
│
├── test/                      # E2E tests
├── .env                       # Environment variables (không commit)
├── .env.example               # Template cho .env
└── package.json
```

---

## 🎯 Các Thành Phần Chính

### 1. **Base Infrastructure** (`src/base/`)

#### Error Handling
- `ErrorCode`: Enum định nghĩa các mã lỗi
- `ERROR_MESSAGES`: Message tương ứng với mỗi error code
- `AppException`: Custom exception class
- `AllExceptionsFilter`: Global exception filter

#### HTTP Response
- `ApiResponse<T>`: Type cho response format chuẩn
  ```typescript
  {
    success: boolean,
    code: ErrorCode,
    message: string,
    data?: T,
    details?: unknown,
    meta: { requestId, timestamp, path, method }
  }
  ```

#### Logging
- `AppLogger`: Custom logger với log levels
- `redact()`: Ẩn thông tin nhạy cảm (password, token, etc.)

#### Middleware
- `RequestContextMiddleware`: Tạo requestId cho mỗi request

### 2. **Modules** (`src/modules/`)

#### Auth Module
- JWT authentication
- Passport integration
- Login/Register endpoints

#### Prisma Module
- Database connection
- Global Prisma service

---

## 🚀 Cách Chạy Project

### Prerequisites
```bash
# Cài đặt dependencies
npm install

# Hoặc dùng yarn
yarn install
```

### Database Setup
```bash
# Chạy PostgreSQL (nếu dùng Docker)
docker-compose up -d

# Chạy migrations
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate
```

### Development
```bash
# Development mode với hot reload
npm run start:dev

# Debug mode
npm run start:debug

# Production mode
npm run start:prod
```

### Build & Lint
```bash
# Build project
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

### Testing
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

---

## 📝 Hướng Dẫn Phát Triển Tiếp

### 1. Tạo Module Mới

```bash
# Generate module với NestJS CLI
nest generate module modules/videos
nest generate controller modules/videos
nest generate service modules/videos
```

**Ví dụ: Tạo Videos Module**

```typescript
// src/modules/videos/videos.module.ts
import { Module } from '@nestjs/common';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VideosController],
  providers: [VideosService],
  exports: [VideosService],
})
export class VideosModule {}
```

```typescript
// src/modules/videos/videos.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { VideosService } from './videos.service';
import { CreateVideoDto } from './dto/create-video.dto';

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  async findAll() {
    return this.videosService.findAll();
  }

  @Post()
  async create(@Body() dto: CreateVideoDto) {
    return this.videosService.create(dto);
  }
}
```

```typescript
// src/modules/videos/videos.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVideoDto } from './dto/create-video.dto';

@Injectable()
export class VideosService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.video.findMany();
  }

  async create(dto: CreateVideoDto) {
    return this.prisma.video.create({
      data: dto,
    });
  }
}
```

Đừng quên thêm module vào `app.module.ts`:
```typescript
import { VideosModule } from './modules/videos/videos.module';

@Module({
  imports: [VideosModule, /* ... */],
})
export class AppModule {}
```

### 2. Tạo DTOs

```typescript
// src/modules/videos/dto/create-video.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class CreateVideoDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUrl()
  @IsNotEmpty()
  url: string;
}
```

### 3. Thêm Guards (Authorization)

```typescript
// src/common/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

Sử dụng trong controller:
```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('videos')
@UseGuards(JwtAuthGuard)
export class VideosController {
  // ...
}
```

### 4. Tạo Custom Decorators

```typescript
// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

Sử dụng:
```typescript
@Get('me')
async getProfile(@CurrentUser() user: User) {
  return user;
}
```

### 5. Database Schema với Prisma

```prisma
// prisma/schema.prisma

model Video {
  id          String   @id @default(uuid())
  title       String
  description String?
  url         String
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("videos")
}
```

Sau khi sửa schema:
```bash
# Tạo migration
npx prisma migrate dev --name add_videos_table

# Generate Prisma Client
npx prisma generate
```

### 6. Error Handling

Sử dụng `AppException` để throw errors:

```typescript
import { AppException } from '../../base';

@Injectable()
export class VideosService {
  async findOne(id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      throw AppException.notFound('Video không tồn tại');
    }

    return video;
  }
}
```

### 7. Pagination & Filtering

```typescript
// src/common/dto/pagination.dto.ts
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
```

```typescript
@Get()
async findAll(@Query() query: PaginationDto) {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    this.prisma.video.findMany({
      skip,
      take: limit,
    }),
    this.prisma.video.count(),
  ]);

  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

---

## 🔧 Environment Variables

Tạo file `.env` dựa trên `.env.example`:

```env
# Application
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/youtube_api?schema=public"

# JWT
JWT_SECRET=your-super-secret-key-here
JWT_EXPIRES_IN=7d

# Logging
LOG_LEVEL=info
```

---

## 📚 Best Practices

### 1. **Code Organization**
- Mỗi module nên tự chứa (self-contained)
- Shared code đặt trong `common/`
- Business logic ở Service, validation ở DTO

### 2. **Error Handling**
- Luôn dùng `AppException` thay vì throw raw errors
- Validate input với class-validator
- Xử lý errors ở Service layer

### 3. **Database**
- Dùng transactions cho operations phức tạp
- Index các field thường query
- Dùng select để giảm payload

### 4. **Security**
- Không log sensitive data (đã có redact)
- Validate tất cả user input
- Dùng Guards cho protected routes
- Hash passwords với argon2

### 5. **Testing**
- Viết unit tests cho Services
- E2E tests cho critical flows
- Mock Prisma trong tests

---

## 🎓 Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

## 🐛 Troubleshooting

### Prisma Client không sync với schema
```bash
npx prisma generate
```

### Port đã được sử dụng
Đổi PORT trong `.env`

### Database connection failed
Kiểm tra DATABASE_URL và PostgreSQL đang chạy

### TypeScript errors
```bash
npm run lint
npx tsc --noEmit
```

---

## 📞 Next Steps

1. **Thêm modules cho features chính:**
   - Videos Module (CRUD videos)
   - Users Module (User profile, settings)
   - Comments Module
   - Playlists Module

2. **Implement advanced features:**
   - File upload (videos, thumbnails)
   - Search & filters
   - Caching với Redis
   - Rate limiting
   - API documentation với Swagger

3. **DevOps:**
   - Docker containerization
   - CI/CD pipeline
   - Monitoring & logging
   - Deployment (AWS, GCP, etc.)

Happy coding! 🚀
