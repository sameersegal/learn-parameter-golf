import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? "/learn-parameter-golf" : "",
  assetPrefix: isProd ? "/learn-parameter-golf/" : "",
  images: { unoptimized: true },
};

export default nextConfig;
