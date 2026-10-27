import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Almost every page reads the session, so Cache Components would force a
  // Suspense boundary around nearly everything for little gain. We use the
  // classic dynamic rendering model instead.
  cacheComponents: false,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
