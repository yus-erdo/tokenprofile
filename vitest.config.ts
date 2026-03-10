import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    testTimeout: 15000,
    include: ["lib/**/__tests__/**/*.test.ts", "test/**/*.test.ts"],
  },
});
