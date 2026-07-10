import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // onnxruntime-node native module için — server-side only
  serverExternalPackages: ["onnxruntime-node"],
};

export default nextConfig;
