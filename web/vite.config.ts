import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 6173,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:6001",
    },
  },
});
