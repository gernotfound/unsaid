/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@unsaid/domain", "@unsaid/catalog", "@unsaid/db", "@unsaid/ui"],
  images: {
    // Product media is generated from high-resolution masters. Keep one global
    // delivery-quality policy instead of ad-hoc per-component overrides.
    qualities: [90],
    formats: ["image/webp"],
  },
};

export default nextConfig;
