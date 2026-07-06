import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
    build: {
        emptyOutDir: false,
        outDir: resolve(root, "../dist/web"),
    },
    plugins: [react()],
    root,
});
