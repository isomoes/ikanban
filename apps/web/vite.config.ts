import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { apiProxyTarget } from "./src/dev-proxy.js";

const config = {
  plugins: [react()],
  build: {
    outDir: "dist",
  },
  server: {
    proxy: {
      "/api": {
        target: apiProxyTarget(process.env),
        ws: true,
      },
    },
  },
  test: {
    environment: "jsdom",
  },
};

export default defineConfig(config);
