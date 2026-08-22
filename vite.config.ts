import { defineConfig } from "vite";

// Project Pages live at https://k-repo123.github.io/raidline/
export default defineConfig({
  base: "/raidline/",
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
