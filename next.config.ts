import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The compiler API is more reliable than the detached CLI in restricted CI environments.
  experimental: { useTypeScriptCli: false },
};

export default nextConfig;
