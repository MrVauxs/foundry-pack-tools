import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractPack, compilePack } from "@foundryvtt/foundryvtt-cli";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");
const OUTPUT_DIR = join(import.meta.dirname, "output-compile");

function findDatabaseFile(): { path: string; nedb: boolean } | null {
    if (!existsSync(FIXTURES_DIR)) return null;
    const entries = readdirSync(FIXTURES_DIR);
    const dbFile = entries.find((e) => e.endsWith(".db"));
    if (dbFile) return { path: join(FIXTURES_DIR, dbFile), nedb: true };
    return null;
}

describe("compilePack", () => {
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

    it("should extract then recompile a NeDB pack", async () => {
        const db = findDatabaseFile();
        if (!db || !db.nedb) {
            return;
        }

        const extractDest = join(OUTPUT_DIR, "extracted");
        const compileDest = join(OUTPUT_DIR, "recompiled.db");

        await extractPack(db.path, extractDest, {
            nedb: true,
            collection: "items",
            documentType: "Item",
            clean: true,
        });

        await compilePack(extractDest, compileDest, {
            nedb: true,
            recursive: true,
        });

        expect(existsSync(compileDest)).toBe(true);
    });

    it("should compile with a transformEntry function", async () => {
        const db = findDatabaseFile();
        if (!db || !db.nedb) {
            return;
        }

        const extractDest = join(OUTPUT_DIR, "extracted-transform");
        const compileDest = join(OUTPUT_DIR, "recompiled-transform.db");

        await extractPack(db.path, extractDest, {
            nedb: true,
            collection: "items",
            documentType: "Item",
            clean: true,
        });

        const transformed: string[] = [];

        await compilePack(extractDest, compileDest, {
            nedb: true,
            recursive: true,
            transformEntry: async (entry) => {
                transformed.push(entry._id);
            },
        });

        expect(transformed.length).toBeGreaterThan(0);
    });

    it("should produce a valid NeDB file after compilation", async () => {
        const db = findDatabaseFile();
        if (!db || !db.nedb) {
            return;
        }

        const extractDest = join(OUTPUT_DIR, "extracted-valid");
        const compileDest = join(OUTPUT_DIR, "recompiled-valid.db");

        await extractPack(db.path, extractDest, {
            nedb: true,
            collection: "items",
            documentType: "Item",
            clean: true,
        });

        await compilePack(extractDest, compileDest, {
            nedb: true,
            recursive: true,
        });

        expect(existsSync(compileDest)).toBe(true);

        const content = readFileSync(compileDest, "utf-8");
        const lines = content.split("\n").filter((line) => line.trim());
        expect(lines.length).toBeGreaterThan(0);

        const firstLine = lines[0];
        expect(() => JSON.parse(firstLine)).not.toThrow();
    });

    it("should roundtrip data correctly", async () => {
        const db = findDatabaseFile();
        if (!db || !db.nedb) {
            return;
        }

        const extractDest = join(OUTPUT_DIR, "extracted-roundtrip");
        const compileDest = join(OUTPUT_DIR, "recompiled-roundtrip.db");
        const reextractDest = join(OUTPUT_DIR, "reextracted");

        await extractPack(db.path, extractDest, {
            nedb: true,
            collection: "items",
            documentType: "Item",
            clean: true,
        });

        await compilePack(extractDest, compileDest, {
            nedb: true,
            recursive: true,
        });

        await extractPack(compileDest, reextractDest, {
            nedb: true,
            collection: "items",
            documentType: "Item",
            clean: true,
        });

        const originalFiles = readdirSync(extractDest).filter((f) => f.endsWith(".json"));
        const roundtripFiles = readdirSync(reextractDest).filter((f) => f.endsWith(".json"));

        expect(originalFiles.length).toBe(roundtripFiles.length);

        for (const file of originalFiles) {
            const original = JSON.parse(readFileSync(join(extractDest, file), "utf-8"));
            const match = roundtripFiles.find((f) => f.includes(original._id));
            if (match) {
                const roundtrip = JSON.parse(readFileSync(join(reextractDest, match), "utf-8"));
                expect(roundtrip._id).toBe(original._id);
                expect(roundtrip.name).toBe(original.name);
            }
        }
    });
});
