import { QueryParams, PaginatedResult } from "@/base/core/query-param";
import { IBaseRepository } from "@/base/core/base.repository";
import { EntityNotFoundException } from "@/base/core/repository.exceptions";
import {
  PrismaDelegate,
  PrismaIncludeValue,
  PrismaQueryArgs,
  WhereClause,
} from "./base-prisma.type";

export abstract class BasePrismaRepository<T> implements IBaseRepository<T> {
  protected abstract entityName: string;

  constructor(protected readonly delegate: PrismaDelegate<T>) {}

  async findAll(params?: QueryParams): Promise<T[]> {
    const queryArgs: PrismaQueryArgs = this.buildQueryArgs(params);
    return await this.delegate.findMany(queryArgs);
  }

  async findAllPaginated(params?: QueryParams): Promise<PaginatedResult<T>> {
    const queryArgs: PrismaQueryArgs = this.buildQueryArgs(params);

    const [total, data] = await Promise.all([
      this.delegate.count({ where: queryArgs.where }),
      this.delegate.findMany(queryArgs),
    ]);

    const page = params?.pagination?.page || 1;
    const limit = params?.pagination?.limit || 10;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: number | string, params?: QueryParams): Promise<T | null> {
    const args: PrismaQueryArgs = {
      where: { id },
    };

    const include = this.buildInclude(params?.include);
    if (include) {
      args.include = include;
    }

    const select = this.buildSelect(params?.select);
    if (select) {
      args.select = select;
    }

    return await this.delegate.findUnique(args);
  }

  async findMany(ids: (number | string)[], params?: QueryParams): Promise<T[]> {
    const queryArgs: PrismaQueryArgs = this.buildQueryArgs(params);
    queryArgs.where = {
      ...queryArgs.where,
      id: { in: ids },
    };

    return await this.delegate.findMany(queryArgs);
  }

  async findBy(
    field: keyof T,
    value: unknown,
    params?: QueryParams,
  ): Promise<T | null> {
    const queryArgs: PrismaQueryArgs = this.buildQueryArgs(params);
    queryArgs.where = {
      ...queryArgs.where,
      [field]: value,
    };

    return await this.delegate.findFirst(queryArgs);
  }

  async count(params?: QueryParams): Promise<number> {
    const where = this.buildWhere(params);
    return await this.delegate.count({ where });
  }

  async exists(id: number | string): Promise<boolean> {
    const count = await this.delegate.count({
      where: { id },
    });
    return count > 0;
  }

  async existsBy(field: keyof T, value: unknown): Promise<boolean> {
    const count = await this.delegate.count({
      where: { [field]: value },
    });
    return count > 0;
  }

  async create(data: Partial<T>): Promise<T> {
    return await this.delegate.create({
      data,
    });
  }

  async update(id: number | string, data: Partial<T>): Promise<T> {
    const exists = await this.exists(id);
    if (!exists) {
      throw new EntityNotFoundException(this.entityName, id);
    }

    return await this.delegate.update({
      where: { id },
      data,
    });
  }

  async delete(id: number | string): Promise<void> {
    const exists = await this.exists(id);
    if (!exists) {
      throw new EntityNotFoundException(this.entityName, id);
    }

    await this.delegate.delete({
      where: { id },
    });
  }

  async createMany(data: Partial<T>[]): Promise<T[]> {
    // prisma.createMany() does not return created records, so we create sequentially
    const created: T[] = [];
    for (const item of data) {
      const entity = await this.delegate.create({ data: item });
      created.push(entity);
    }
    return created;
  }

  async updateMany(
    ids: (number | string)[],
    data: Partial<T>,
  ): Promise<{ count: number }> {
    return await this.delegate.updateMany({
      where: { id: { in: ids } },
      data,
    });
  }

  async deleteMany(ids: (number | string)[]): Promise<{ count: number }> {
    return await this.delegate.deleteMany({
      where: { id: { in: ids } },
    });
  }

  protected buildQueryArgs(params?: QueryParams): PrismaQueryArgs {
    if (!params) return {};

    const queryArgs: PrismaQueryArgs = {};

    queryArgs.where = this.buildWhere(params);

    if (params.sort) {
      queryArgs.orderBy = this.buildOrderBy(params.sort);
    }

    if (params.pagination) {
      const { page, limit } = params.pagination;
      queryArgs.skip = (page - 1) * limit;
      queryArgs.take = limit;
    }

    if (params.select) {
      queryArgs.select = this.buildSelect(params.select);
    }

    const include = this.buildInclude(params?.include);
    if (include) {
      queryArgs.include = include;
    }

    return queryArgs;
  }

  protected buildWhere(params?: QueryParams): WhereClause | undefined {
    if (!params) return undefined;

    let where: WhereClause = {};

    if (params.search) {
      const { text, fields } = params.search;
      const orConditions = fields.map((field) => ({
        [field]: {
          contains: text,
          mode: "insensitive",
        },
      }));

      where = { ...where, OR: orConditions };
    }

    if (params.filter) {
      where = { ...where, ...params.filter };
    }

    return Object.keys(where).length > 0 ? where : undefined;
  }

  protected buildOrderBy(
    sort: QueryParams["sort"],
  ): PrismaQueryArgs["orderBy"] {
    if (!sort) return undefined;

    if (Array.isArray(sort)) {
      return sort.map((s) => ({
        [s.field]: s.order.toLowerCase() as "asc" | "desc",
      }));
    }

    return {
      [sort.field]: sort.order.toLowerCase() as "asc" | "desc",
    };
  }

  protected buildSelect(
    fields?: string[],
  ): Record<string, boolean> | undefined {
    if (!fields || fields.length === 0) return undefined;

    return fields.reduce(
      (acc, field) => {
        acc[field] = true;
        return acc;
      },
      {} as Record<string, boolean>,
    );
  }

  protected buildInclude(
    include?: Record<string, boolean | QueryParams>,
  ): Record<string, boolean | PrismaIncludeValue> | undefined {
    if (!include) return undefined;

    return Object.entries(include).reduce(
      (acc, [key, value]) => {
        if (typeof value === "boolean") {
          acc[key] = value;
        } else {
          acc[key] = {
            ...this.buildQueryArgs(value),
          } as PrismaIncludeValue;
        }
        return acc;
      },
      {} as Record<string, boolean | PrismaIncludeValue>,
    );
  }
}
