import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // The push service worker must always be fetched fresh and may control the whole site.
    return [
      {
        source: "/firebase-messaging-sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Intake photos: up to 8 × 5 MB (usually far less after in-browser
      // compression); user photos 2 MB. Leaves room for multipart overhead.
      bodySizeLimit: "45mb",
    },
  },
};

export default nextConfig;
