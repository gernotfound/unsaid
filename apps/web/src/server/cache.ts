export const CACHE_TAGS = {
  catalog: "catalog",
  home: "home",
} as const;

export function productCacheTag(slug: string) {
  return `product:${slug}`;
}

export function catalogPageCacheTag(sort: string, cursor?: number) {
  return `catalog:${sort}:${cursor ?? "first"}`;
}
