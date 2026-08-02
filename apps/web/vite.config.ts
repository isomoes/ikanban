import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = {
  plugins: [react()],
  build: {
    outDir: "dist",
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4097",
        ws: true,
      },
    },
  },
  test: {
    environment: "jsdom",
  },
};

export default defineConfig(config);
