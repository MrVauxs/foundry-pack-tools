import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        include: ["**/*.test.ts"],
        testTimeout: 60000,
        reporters: ["verbose"],
    },
});
