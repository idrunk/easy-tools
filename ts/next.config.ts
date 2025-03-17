import type { NextConfig } from "next";
import configData from './config.json';

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_CONFIG: JSON.stringify(configData)
  }
};

export default nextConfig;
