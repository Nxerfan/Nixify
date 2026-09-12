import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  reactStrictMode: false,
  // Allow the dev server to serve /_next/* resources when the preview is
  // reached via loopback or a gateway origin (silences the Next 16 dev warning
  // and keeps client-side navigation working in the preview panel).
  allowedDevOrigins: ["127.0.0.1", "localhost", "0.0.0.0"],
};

export default nextConfig;
