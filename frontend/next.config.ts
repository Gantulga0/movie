import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The monorepo root also has a package-lock.json, so Turbopack infers the
  // wrong workspace root and then fails to resolve packages ("Next.js package
  // not found" panics). Pin the root to this app; the dev/build scripts always
  // run with frontend/ as the working directory (npm --prefix frontend).
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
