import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@fezer/shared": path.resolve(templateRoot, "shared", "src"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "client/src/content/loaders/__tests__/*.test.ts",
      "client/src/hooks/__tests__/*.test.ts",
      "client/src/components/__tests__/*.test.tsx",
    ],
  },
});
