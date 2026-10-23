import { defineConfig } from "vite";

// The tablet web app (web/index.html), published to GitHub Pages. Relative asset paths let it
// run from any folder, such as https://<user>.github.io/<repo>/.
export default defineConfig({
  root: "web",
  base: "./",
  server: { port: 1421 },
  build: {
    target: ["es2021", "safari15"],
    outDir: "../dist-web",
    emptyOutDir: true,
  },
});
