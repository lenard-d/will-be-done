import path from "path";
import type { PluginOption } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";
import { configDefaults, defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }) as unknown as PluginOption,
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", {}]],
      },
    }),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      workbox: {
        clientsClaim: true,
        globPatterns: [
          "**/*.{js,css,html,woff2,json,svg,wasm,webmanifest,png}",
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/rsms\.me\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "rsms-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.VITE_API_PORT || "3000"}`,
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying
      },
    },
  },
  test: {
    exclude: [...configDefaults.exclude, "e2e/**", "**/*.browser.test.ts"],
  },
});
