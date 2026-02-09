import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["src/test/env.ts"],
    exclude: ["**/dist/**", "**/node_modules/**", "**/.git/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70
      },
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/config.ts",
        "src/db/**",
        "src/models/**"
      ]
    }
  }
});
