import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Allow the temporary Cloudflare quick-tunnel address (demo only).
    allowedHosts: [".trycloudflare.com"],
    // When the app is opened through the laptop's LAN IP (start-all.ps1 -Lan),
    // the browser calls /api on port 5173 and Vite forwards it to Laravel on
    // the same laptop. A phone then only needs to reach port 5173.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
