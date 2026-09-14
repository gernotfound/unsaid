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

export interface CatalogStats {
  total: number;
  public: number;
  ready: number;
  concepts: number;
  review: number;
  adult: number;
  sensitive: number;
}

export interface CatalogRepository<T> {
  list(query?: CatalogQuery): Promise<CatalogPage<T>>;
  getBySlug(slug: string): Promise<T | undefined>;
  getFeatured(): Promise<T | undefined>;
  getStats(): Promise<CatalogStats>;
}
