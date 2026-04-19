import { QueryParams, PaginatedResult } from './query-param';

export interface IBaseRepository<T> {
  findAll(params?: QueryParams): Promise<T[]>;

  findAllPaginated(params?: QueryParams): Promise<PaginatedResult<T>>;

  findOne(id: number | string, params?: QueryParams): Promise<T | null>;

  findMany(ids: (number | string)[], params?: QueryParams): Promise<T[]>;

  findBy(
    field: keyof T,
    value: unknown,
    params?: QueryParams,
  ): Promise<T | null>;

  count(params?: QueryParams): Promise<number>;

  exists(id: number | string): Promise<boolean>;

  existsBy(field: keyof T, value: unknown): Promise<boolean>;

  create(data: Partial<T>): Promise<T>;

  update(id: number | string, data: Partial<T>): Promise<T>;

  delete(id: number | string): Promise<void>;

  softDelete?(id: number | string): Promise<void>;

  restore?(id: number | string): Promise<void>;

  createMany(data: Partial<T>[]): Promise<T[]>;

  updateMany(
    ids: (number | string)[],
    data: Partial<T>,
  ): Promise<{ count: number }>;

  deleteMany(ids: (number | string)[]): Promise<{ count: number }>;
}
