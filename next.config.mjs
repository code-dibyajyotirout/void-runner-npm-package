/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
