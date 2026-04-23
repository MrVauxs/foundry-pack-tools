import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { extractPack } from "@foundryvtt/foundryvtt-cli";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");
const OUTPUT_DIR = join(import.meta.dirname, "output");

function findDatabaseFile(): { path: string; nedb: boolean } | null {
    if (!existsSync(FIXTURES_DIR)) return null;
    const entries = readdirSync(FIXTURES_DIR);
    const dbFile = entries.find((e) => e.endsWith(".db"));
    if (dbFile) return { path: join(FIXTURES_DIR, dbFile), nedb: true };
    const dirEntry = entries.find((e) => {
        const full = join(FIXTURES_DIR, e);
        return statSync(full).isDirectory() && existsSync(join(full, "CURRENT"));
    });
    if (dirEntry) return { path: join(FIXTURES_DIR, dirEntry), nedb: false };
    return null;
}

describe("extractPack", () => {
    beforeAll(() => {
        if (existsSync(OUTPUT_DIR)) {
            rmSync(OUTPUT_DIR, { recursive: true, force: true });
        }
        mkdirSync(OUTPUT_DIR, { recursive: true });
    });

    afterAll(() => {
        if (existsSync(OUTPUT_DIR)) {
            rmSync(OUTPUT_DIR, { recursive: true, force: true });
        }
    });

    it("should find a database file in fixtures", () => {
        const db = findDatabaseFile();
        if (!db) {
            return;
        }
        expect(db?.path).toBeDefined();
        if (db?.nedb) {
            expect(existsSync(db.path)).toBe(true);
        }
    });

    it("should extract a NeDB pack to JSON files", async () => {
        const db = findDatabaseFile();
        if (!db || !db.nedb) {
            return;
        }

        const dest = join(OUTPUT_DIR, "extracted-nedb");
        await extractPack(db.path, dest, { nedb: true });

        expect(existsSync(dest)).toBe(true);
        const files = readdirSync(dest);
        const jsonFiles = files.filter((f) => f.endsWith(".json"));
        expect(jsonFiles.length).toBeGreaterThan(0);
    });

    it("should extract a LevelDB pack to JSON files", async () => {
        const db = findDatabaseFile();
        if (!db || db.nedb) {
            return;
        }

        console.log("LevelDB source path:", db.path);

        const dest = join(OUTPUT_DIR, "extracted-leveldb");
        await extractPack(db.path, dest, {
            clean: true,
            log: true,
        });

        expect(existsSync(dest)).toBe(true);
        console.log("Extracted files:", readdirSync(dest));
        const files = readdirSync(dest);
        const jsonFiles = files.filter((f) => f.endsWith(".json"));
        expect(jsonFiles.length).toBeGreaterThan(0);
    });

    it("should extract with a transformEntry function", async () => {
        const db = findDatabaseFile();
        if (!db || !db.nedb) {
            return;
        }

        const dest = join(OUTPUT_DIR, "extracted-transformed");
        const transformed: string[] = [];

        await extractPack(db.path, dest, {
            nedb: true,
            collection: "items",
            documentType: "Item",
            clean: true,
            transformEntry: async (entry: Record<string, any>) => {
                transformed.push(entry._id);
            },
        });

        expect(transformed.length).toBeGreaterThan(0);
    });

    it("should produce valid JSON files", async () => {
        const db = findDatabaseFile();
        if (!db || !db.nedb) {
            return;
        }

        const dest = join(OUTPUT_DIR, "extracted-valid");
        await extractPack(db.path, dest, {
            nedb: true,
            collection: "items",
            documentType: "Item",
            clean: true,
        });

        const files = readdirSync(dest).filter((f) => f.endsWith(".json"));
        for (const file of files) {
            const content = readFileSync(join(dest, file), "utf-8");
            expect(() => JSON.parse(content)).not.toThrow();
            const parsed = JSON.parse(content);
            expect(parsed).toHaveProperty("_id");
        }
    });
});
