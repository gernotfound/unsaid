/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@unsaid/domain", "@unsaid/catalog", "@unsaid/db", "@unsaid/ui"],
  images: {
    qualities: [75, 90],
  },
};

export default nextConfig;
