# Base Repository Pattern - Hướng dẫn sử dụng

## Tổng quan

Base Repository Pattern cung cấp một lớp trừu tượng để thao tác với database thông qua Prisma ORM với đầy đủ type safety và các tính năng nâng cao.

## Tính năng

### ✅ CRUD Operations
- `findAll()` - Lấy tất cả records với query options
- `findAllPaginated()` - Lấy records với pagination metadata
- `findOne()` - Tìm 1 record theo ID
- `findMany()` - Tìm nhiều records theo danh sách IDs
- `findBy()` - Tìm record theo field bất kỳ
- `create()` - Tạo 1 record
- `update()` - Cập nhật 1 record
- `delete()` - Xóa 1 record

### ✅ Advanced Queries
- **Search**: Tìm kiếm text trên nhiều fields (case-insensitive)
- **Filter**: Lọc với conditions phức tạp
- **Sort**: Sắp xếp theo 1 hoặc nhiều fields
- **Pagination**: Phân trang với metadata đầy đủ
- **Select**: Chọn fields cụ thể
- **Include**: Load relations (nested queries)

### ✅ Utility Methods
- `count()` - Đếm số records
- `exists()` - Kiểm tra tồn tại theo ID
- `existsBy()` - Kiểm tra tồn tại theo field

### ✅ Bulk Operations
- `createMany()` - Tạo nhiều records
- `updateMany()` - Cập nhật nhiều records
- `deleteMany()` - Xóa nhiều records

### ✅ Error Handling
- `EntityNotFoundException` - Entity không tồn tại
- `EntityAlreadyExistsException` - Entity đã tồn tại
- `InvalidQueryException` - Query không hợp lệ
- `BulkOperationException` - Lỗi bulk operation

## Cách sử dụng

### 1. Tạo Repository cho Entity

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import { BasePrismaRepository } from '@/base/core';

@Injectable()
export class UserRepository extends BasePrismaRepository<User> {
  protected entityName = 'User';

  constructor(private prisma: PrismaService) {
    super(prisma.user);
  }

  // Thêm custom methods nếu cần
  async findByEmail(email: string): Promise<User | null> {
    return this.findBy('email', email);
  }

  async findActiveUsers(): Promise<User[]> {
    return this.findAll({
      filter: { isActive: true },
      sort: { field: 'createdAt', order: 'DESC' },
    });
  }
}
```

### 2. Sử dụng trong Service

```typescript
import { Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { QueryParams } from '@/base/core';

@Injectable()
export class UserService {
  constructor(private userRepository: UserRepository) {}

  // Basic CRUD
  async getAllUsers() {
    return this.userRepository.findAll();
  }

  async getUserById(id: number) {
    return this.userRepository.findOne(id);
  }

  async createUser(data: CreateUserDto) {
    return this.userRepository.create(data);
  }

  async updateUser(id: number, data: UpdateUserDto) {
    return this.userRepository.update(id, data);
  }

  async deleteUser(id: number) {
    return this.userRepository.delete(id);
  }

  // Advanced queries
  async searchUsers(searchText: string, page = 1, limit = 10) {
    return this.userRepository.findAllPaginated({
      search: {
        text: searchText,
        fields: ['name', 'email', 'username'],
      },
      pagination: { page, limit },
      sort: { field: 'name', order: 'ASC' },
    });
  }

  async getActiveUsersWithPosts() {
    return this.userRepository.findAll({
      filter: { isActive: true },
      include: {
        posts: true, // Load relation
        profile: {
          select: ['bio', 'avatar'], // Nested select
        },
      },
      select: ['id', 'name', 'email'], // Select specific fields
    });
  }

  // Bulk operations
  async createMultipleUsers(users: CreateUserDto[]) {
    return this.userRepository.createMany(users);
  }

  async deactivateUsers(userIds: number[]) {
    return this.userRepository.updateMany(userIds, { isActive: false });
  }
}
```

### 3. Sử dụng trong Controller

```typescript
import { Controller, Get, Post, Put, Delete, Query, Param, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './dto';

@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    if (search) {
      return this.userService.searchUsers(search, +page, +limit);
    }
    return this.userService.getAllUsers();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.userService.getUserById(+id);
  }

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.updateUser(+id, updateUserDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.userService.deleteUser(+id);
  }
}
```

## Query Parameters Chi Tiết

### Search
```typescript
{
  search: {
    text: "john",
    fields: ["name", "email", "username"]
  }
}
```

### Filter
```typescript
{
  filter: {
    isActive: true,
    role: "admin",
    age: { operator: 'gte', value: 18 }
  }
}
```

### Sort (Single)
```typescript
{
  sort: {
    field: "createdAt",
    order: "DESC"
  }
}
```

### Sort (Multiple)
```typescript
{
  sort: [
    { field: "isActive", order: "DESC" },
    { field: "name", order: "ASC" }
  ]
}
```

### Pagination
```typescript
{
  pagination: {
    page: 1,
    limit: 20
  }
}
```

### Select Fields
```typescript
{
  select: ["id", "name", "email"]
}
```

### Include Relations
```typescript
{
  include: {
    posts: true,
    profile: {
      select: ["bio", "avatar"]
    },
    comments: {
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 10
    }
  }
}
```

## Pagination Response

```typescript
{
  data: [...],
  meta: {
    total: 100,
    page: 1,
    limit: 20,
    totalPages: 5,
    hasNextPage: true,
    hasPreviousPage: false
  }
}
```

## Best Practices

1. **Luôn định nghĩa entityName** để error messages rõ ràng
2. **Sử dụng findAllPaginated()** cho danh sách lớn
3. **Validate input** trước khi gọi repository methods
4. **Handle exceptions** từ repository trong service layer
5. **Sử dụng select** để giảm data transfer khi không cần tất cả fields
6. **Cẩn thận với include** để tránh N+1 queries

## Migration từ code cũ

```typescript
// Trước (TypeORM)
const users = await userRepository.createQueryBuilder('user')
  .where('user.name ILIKE :name', { name: '%john%' })
  .orderBy('user.createdAt', 'DESC')
  .skip(0)
  .take(10)
  .getMany();

// Sau (Prisma Base Repository)
const users = await userRepository.findAll({
  search: { text: 'john', fields: ['name'] },
  sort: { field: 'createdAt', order: 'DESC' },
  pagination: { page: 1, limit: 10 }
});
```
