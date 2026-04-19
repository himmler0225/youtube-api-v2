export type FilterOperator =
  | 'equals'
  | 'not'
  | 'in'
  | 'notIn'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'contains'
  | 'startsWith'
  | 'endsWith';

export interface FilterValue {
  operator?: FilterOperator;
  value: unknown;
}

export type FilterCondition = Record<
  string,
  string | number | boolean | null | FilterValue | (string | number | boolean)[]
>;

export interface SortOption {
  field: string;
  order: 'ASC' | 'DESC';
}

export interface QueryParams {
  search?: {
    text: string;
    fields: string[];
  };

  filter?: FilterCondition;

  sort?: SortOption | SortOption[];

  pagination?: {
    page: number;
    limit: number;
  };

  select?: string[];

  include?: Record<string, boolean | QueryParams>;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
