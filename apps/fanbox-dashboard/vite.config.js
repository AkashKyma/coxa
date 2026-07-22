import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5178,
    proxy: {
      "/api": { target: "http://localhost:5000", changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      "@coxa/ui-analytics": resolve(__dirname, "../../packages/ui-analytics/src/index.js"),
    },
  },
  optimizeDeps: {
    include: ["recharts", "lucide-react"],
    exclude: ["@coxa/ui-analytics"],
  },
});
