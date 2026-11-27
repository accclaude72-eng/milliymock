import type { NextConfig } from "next";

const e = process.env;

const nextConfig: NextConfig = {
  // Expose ONLY the public Supabase values to the browser, accepting either naming style
  // (NEXT_PUBLIC_SUPABASE_* or SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY).
  // The secret key is never listed here.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: e.NEXT_PUBLIC_SUPABASE_URL ?? e.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? e.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? e.SUPABASE_PUBLISHABLE_KEY ?? e.SUPABASE_ANON_KEY ?? "",
  },
  cacheComponents: true,
  partialPrefetching: true,
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
