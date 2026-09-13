/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_PAGES === "true";
const basePath = isGitHubPages ? (process.env.NEXT_PUBLIC_BASE_PATH || "/unsaid") : "";

const nextConfig = {
  transpilePackages: ["@unsaid/domain", "@unsaid/catalog", "@unsaid/db", "@unsaid/ui"],
  ...(isGitHubPages
    ? {
        output: "export",
        basePath,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
