import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Intake photos: up to 8 × 5 MB (usually far less after in-browser
      // compression); user photos 2 MB. Leaves room for multipart overhead.
      bodySizeLimit: "45mb",
    },
  },
};

export default nextConfig;
