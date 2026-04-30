export type WhereClause = Record<string, unknown>;

export interface PrismaIncludeValue {
  where?: WhereClause;
  select?: Record<string, boolean>;
  include?: Record<string, boolean | PrismaIncludeValue>;
  orderBy?: Record<string, "asc" | "desc">;
  skip?: number;
  take?: number;
}

export interface PrismaQueryArgs {
  where?: WhereClause;
  orderBy?: Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[];
  skip?: number;
  take?: number;
  select?: Record<string, boolean>;
  include?: Record<string, boolean | PrismaIncludeValue>;
}

/**
 * PrismaDelegate<T> — interface bọc Prisma model delegate (prisma.user, prisma.video...)
 *
 * Tại sao dùng `any` cho args:
 * Prisma generate ra type rất cụ thể cho từng model (UserWhereUniqueInput,
 * VideoWhereInput...). Khi kiểm tra function assignability theo contravariance,
 * TypeScript yêu cầu args của interface phải hẹp hơn hoặc bằng args của
 * Prisma delegate — điều này không thể đạt được với generic types.
 * → Dùng `any` cho args để interface này compatible với mọi Prisma delegate,
 *   trong khi return type vẫn được typed chính xác theo T.
 */
export interface PrismaDelegate<T> {
  findMany: (args?: any) => Promise<T[]>;
  findUnique: (args: any) => Promise<T | null>;
  findFirst: (args?: any) => Promise<T | null>;
  create: (args: any) => Promise<T>;
  createMany: (args: any) => Promise<{ count: number }>;
  update: (args: any) => Promise<T>;
  updateMany: (args: any) => Promise<{ count: number }>;
  delete: (args: any) => Promise<T>;
  deleteMany: (args: any) => Promise<{ count: number }>;
  count: (args?: any) => Promise<number>;
}
