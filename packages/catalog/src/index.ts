import type { Product } from "@unsaid/domain";
export interface CatalogQuery { q?: string; category?: string; language?: "it" | "en" | "mixed"; includeAdult?: boolean; cursor?: string; limit?: number; }
export interface CatalogPage { items: readonly Product[]; nextCursor?: string; }
export type CatalogRepository = (query: CatalogQuery) => Promise<CatalogPage>;
