import type { NextConfig } from "next";

const useBasePath = process.env.LOCAL_DEV !== "1";

const nextConfig: NextConfig = {
  output: "export",
  basePath: useBasePath ? "/learn-parameter-golf" : "",
  assetPrefix: useBasePath ? "/learn-parameter-golf/" : "",
  images: { unoptimized: true },
};

export default nextConfig;
