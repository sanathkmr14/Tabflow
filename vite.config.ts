import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import webExtension from "vite-plugin-web-extension";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    webExtension({
      manifest: "./manifest.json",
      additionalInputs: [
        "src/content/extractor.ts",
        "src/dashboard/index.html"
      ],
      disableAutoLaunch: false,
      skipManifestValidation: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      output: {
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
});
