import type { NextConfig } from "next";

const replitDomain = process.env.REPLIT_DOMAINS;

const nextConfig: NextConfig = {
  allowedDevOrigins: replitDomain ? [replitDomain] : [],
};

export default nextConfig;
