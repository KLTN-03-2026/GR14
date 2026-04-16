export interface PaginationResult<T> {
  data: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginationResult<T> {
  return {
    data: items,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    totalItems: total,
  };
}
