import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Almost every page reads the session, so Cache Components would force a
  // Suspense boundary around nearly everything for little gain. We use the
  // classic dynamic rendering model instead.
  cacheComponents: false,
  poweredByHeader: false,
  // Self-contained server for the Docker image (set in the Dockerfile only;
  // on Windows the standalone copy would need symlink rights).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // Native modules must not be bundled.
  serverExternalPackages: ["@node-rs/argon2", "sharp", "heic-convert", "playwright-core"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
