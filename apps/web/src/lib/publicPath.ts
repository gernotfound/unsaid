export const PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function assetPath(path: string) {
  if (!path.startsWith("/") || !PUBLIC_BASE_PATH) return path;
  if (path === PUBLIC_BASE_PATH || path.startsWith(`${PUBLIC_BASE_PATH}/`)) return path;
  return `${PUBLIC_BASE_PATH}${path}`;
}
