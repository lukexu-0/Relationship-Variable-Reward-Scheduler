import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    exclude: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.git/**",
      "e2e/**",
      "playwright.config.ts"
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 60
      },
      include: ["src/**/*.tsx", "src/**/*.ts"],
      exclude: [
        "src/main.tsx",
        "src/styles.css",
        "src/lib/api/**",
        "src/test/**"
      ]
    }
  }
});
