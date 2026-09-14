export * from "./archive";

export type CatalogSort = "newest" | "archive";

export interface CatalogQuery {
  cursor?: number | undefined;
  limit?: number | undefined;
  sort?: CatalogSort | undefined;
}

export interface CatalogPage<T> {
  items: readonly T[];
  nextCursor?: number | undefined;
}

export type CatalogRepository<T> = (query?: CatalogQuery) => Promise<CatalogPage<T>>;
