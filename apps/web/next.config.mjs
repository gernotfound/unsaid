/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@unsaid/domain", "@unsaid/catalog", "@unsaid/db", "@unsaid/ui"],
};

export default nextConfig;
