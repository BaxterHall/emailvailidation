import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  basePath: "/emailvailidation",
  assetPrefix: "/emailvailidation/",
};

export default nextConfig;
