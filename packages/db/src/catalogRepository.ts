import type { CatalogRecord, CatalogRepository } from "@unsaid/catalog";
import {
  getCatalogStats,
  getFeaturedPublicProduct,
  getPublicProductBySlug,
  listPublicCatalogPage,
} from "./catalog";

export const publicCatalogRepository: CatalogRepository<CatalogRecord> = {
  list: listPublicCatalogPage,
  getBySlug: getPublicProductBySlug,
  getFeatured: getFeaturedPublicProduct,
  getStats: getCatalogStats,
};
