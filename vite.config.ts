import { resolve } from "node:path";
import { defineConfig } from "vite";

// Tauri expects a fixed dev server port and serves the built files from dist/.
// Two pages: the full-screen drawing overlay and the floating toolbar.
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    target: ["es2021", "safari15"],
    outDir: "dist",
    rollupOptions: {
      input: {
        overlay: resolve(__dirname, "index.html"),
        toolbar: resolve(__dirname, "toolbar.html"),
      },
    },
  },
});
