import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/")) {
            if (/\/(react|react-dom|scheduler)\//.test(id))
              return "react-vendor";
            if (id.includes("/motion") || id.includes("/framer-motion/"))
              return "motion";
            if (id.includes("/dexie")) return "storage";
          }
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/*.png"],
      manifest: {
        name: "Pockit · School & everyday money",
        short_name: "Pockit",
        description: "Your offline student and financial companion.",
        theme_color: "#3265d8",
        background_color: "#fffdf6",
        display: "standalone",
        start_url: ".",
        scope: ".",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        importScripts: ["push-handler.js"],
        globPatterns: ["**/*.{js,css,html,png,woff2}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  test: {
    include: ["src/**/*.test.ts", "cloudflare/**/*.test.ts"],
    setupFiles: ["src/test-setup.ts"],
  },
});
