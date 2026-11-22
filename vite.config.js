import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./", // relative paths, so the build works in any folder or sub-path
  plugins: [react()],
  server: { host: true, port: 5173 },
});
