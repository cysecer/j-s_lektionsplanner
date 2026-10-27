import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Almost every page reads the session, so Cache Components would force a
  // Suspense boundary around nearly everything for little gain. We use the
  // classic dynamic rendering model instead.
  cacheComponents: false,
  poweredByHeader: false,
  // Native modules must not be bundled.
  serverExternalPackages: ["@node-rs/argon2"],
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
