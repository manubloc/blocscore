import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" keeps asset paths relative so it works on GitHub Pages
// (https://user.github.io/blocscore/) as well as Vercel/Netlify root.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
