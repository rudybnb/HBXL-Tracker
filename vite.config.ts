import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "shared": path.resolve(__dirname, "shared"),
      "shared-cashflow": path.resolve(__dirname, "shared-cashflow"),
    },
  },
  root: "client",
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
  },
  server: {
    hmr: true, // Force HMR
    watch: {
      usePolling: true, // Force polling which catches file changes better on some systems
    }
  },
  // Force rebuild timestamp
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(Date.now()),
  }
});
