/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow remote product images from arbitrary marketplaces without per-host config.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
