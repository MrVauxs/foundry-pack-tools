import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { extractPack, compilePack } from "@foundryvtt/foundryvtt-cli";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");
const EXTRACT_OUTPUT_DIR = join(import.meta.dirname, "output");
const COMPILE_OUTPUT_DIR = join(import.meta.dirname, "output-compile");

function findDatabaseFiles(): Array<{ path: string; nedb: boolean; label: string }> {
    const results: Array<{ path: string; nedb: boolean; label: string }> = [];
    if (!existsSync(FIXTURES_DIR)) return results;
    const walk = (dir: string, baseName: string) => {
        const entries = readdirSync(dir);
        for (const entry of entries) {
            const full = join(dir, entry);
            const stats = statSync(full);
            if (stats.isDirectory()) {
                const isLevelDB = existsSync(join(full, "CURRENT"));
                if (isLevelDB) {
                    results.push({ path: full, nedb: false, label: `${baseName}/${entry}` });
                } else {
                    walk(full, `${baseName}/${entry}`);
                }
            } else if (entry.endsWith(".db")) {
                results.push({ path: full, nedb: true, label: `${baseName}/${entry}` });
            }
        }
    };
    walk(FIXTURES_DIR, "fixtures");
    return results;
}

function findNeDBFile(): { path: string; label: string } | null {
    return findDatabaseFiles().find((d) => d.nedb) ?? null;
}

function findLevelDBDirectory(): { path: string; label: string } | null {
    return findDatabaseFiles().find((d) => !d.nedb) ?? null;
}

function reportDatabaseState(): void {
    const databases = findDatabaseFiles();
    if (databases.length === 0) {
        console.log("No database files found in", FIXTURES_DIR);
    } else {
        for (const db of databases) {
            console.log(`Found ${db.nedb ? "NeDB" : "LevelDB"}: ${db.label} at ${db.path}`);
        }
    }
}

describe.sequential("extractPack", () => {
    beforeAll(() => {
        if (existsSync(EXTRACT_OUTPUT_DIR)) {
            rmSync(EXTRACT_OUTPUT_DIR, { recursive: true, force: true });
        }
        mkdirSync(EXTRACT_OUTPUT_DIR, { recursive: true });
        reportDatabaseState();
    });

    afterAll(() => {
        if (existsSync(EXTRACT_OUTPUT_DIR)) {
            rmSync(EXTRACT_OUTPUT_DIR, { recursive: true, force: true });
        }
    });

    it("should find database files in fixtures", () => {
        const databases = findDatabaseFiles();
        if (databases.length === 0) {
            return;
        }
        for (const db of databases) {
            expect(existsSync(db.path)).toBe(true);
        }
    });

    it("should extract a NeDB pack to JSON files", async () => {
        const db = findNeDBFile();
        if (!db) {
            return;
        }

        const dest = join(EXTRACT_OUTPUT_DIR, "extracted-nedb");
        await extractPack(db.path, dest, { nedb: true });

        expect(existsSync(dest)).toBe(true);
        const files = readdirSync(dest);
        const jsonFiles = files.filter((f) => f.endsWith(".json"));
        expect(jsonFiles.length).toBeGreaterThan(0);
    });

    it("should extract a LevelDB pack to JSON files", async () => {
        const db = findLevelDBDirectory();
        if (!db) {
            return;
        }

        console.log("LevelDB source path:", db.path);

        const dest = join(EXTRACT_OUTPUT_DIR, "extracted-leveldb");
        await extractPack(db.path, dest, {
            clean: true,
        });

        expect(existsSync(dest)).toBe(true);
        const files = readdirSync(dest);
        if (files.length === 0) {
            throw new Error(
                `LevelDB extraction produced no files.\n` +
                `Source: ${db.path}\n` +
                `Check that the LevelDB contains data and that extractPack is configured correctly.`,
            );
        }
        console.log(`Extracted ${files.length} files from LevelDB`);
        const jsonFiles = files.filter((f) => f.endsWith(".json"));
        expect(jsonFiles.length).toBeGreaterThan(0);
    });

    it("should extract with a transformEntry function", async () => {
        const db = findNeDBFile();
        if (!db) {
            return;
        }

        const dest = join(EXTRACT_OUTPUT_DIR, "extracted-transformed");
        const transformed: string[] = [];

        await extractPack(db.path, dest, {
            nedb: true,
            collection: "items",
            documentType: "Item",
            clean: true,
            transformEntry: async (entry) => {
                transformed.push(entry._id);
            },
        });

        expect(transformed.length).toBeGreaterThan(0);
    });

    it("should produce valid JSON files", async () => {
        const db = findNeDBFile();
        if (!db) {
            return;
        }

        const dest = join(EXTRACT_OUTPUT_DIR, "extracted-valid");
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

describe.sequential("compilePack", () => {
    beforeAll(() => {
        if (existsSync(COMPILE_OUTPUT_DIR)) {
            rmSync(COMPILE_OUTPUT_DIR, { recursive: true, force: true });
        }
        mkdirSync(COMPILE_OUTPUT_DIR, { recursive: true });
    });

    afterAll(() => {
        if (existsSync(COMPILE_OUTPUT_DIR)) {
            rmSync(COMPILE_OUTPUT_DIR, { recursive: true, force: true });
        }
    });

    it("should extract then recompile a NeDB pack", async () => {
        const db = findNeDBFile();
        if (!db) {
            return;
        }

        const extractDest = join(COMPILE_OUTPUT_DIR, "extracted");
        const compileDest = join(COMPILE_OUTPUT_DIR, "recompiled.db");

        await extractPack(db.path, extractDest, {
            nedb: true,
            collection: "items",
            documentType: "Item",
            clean: true,
        });

        const extractedFiles = readdirSync(extractDest).filter((f) => f.endsWith(".json"));
        if (extractedFiles.length === 0) {
            throw new Error(
                `Extraction produced no JSON files.\n` +
                `Source: ${db.path}\n` +
                `Check the collection/documentType match the pack contents.`,
            );
        }

        await compilePack(extractDest, compileDest, {
            nedb: true,
            recursive: true,
        });

        expect(existsSync(compileDest)).toBe(true);
    });

    it("should compile with a transformEntry function", async () => {
        const db = findNeDBFile();
        if (!db) {
            return;
        }

        const extractDest = join(COMPILE_OUTPUT_DIR, "extracted-transform");
        const compileDest = join(COMPILE_OUTPUT_DIR, "recompiled-transform.db");

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
        const db = findNeDBFile();
        if (!db) {
            return;
        }

        const extractDest = join(COMPILE_OUTPUT_DIR, "extracted-valid");
        const compileDest = join(COMPILE_OUTPUT_DIR, "recompiled-valid.db");

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
        if (lines.length === 0) {
            throw new Error(
                `Compiled NeDB file is empty.\n` +
                `Extracted from: ${db.path}\n` +
                `Check that source files have _key fields.`,
            );
        }

        const firstLine = lines[0];
        expect(() => JSON.parse(firstLine)).not.toThrow();
    });

    it("should roundtrip data correctly", async () => {
        const db = findNeDBFile();
        if (!db) {
            return;
        }

        const extractDest = join(COMPILE_OUTPUT_DIR, "extracted-roundtrip");
        const compileDest = join(COMPILE_OUTPUT_DIR, "recompiled-roundtrip.db");
        const reextractDest = join(COMPILE_OUTPUT_DIR, "reextracted");

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

        if (originalFiles.length === 0) {
            throw new Error(`Original extraction produced no files. Source: ${db.path}`);
        }

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

    it("should extract then recompile a LevelDB pack", async () => {
        const db = findLevelDBDirectory();
        if (!db) {
            return;
        }

        console.log("LevelDB source:", db.path);

        const extractDest = join(COMPILE_OUTPUT_DIR, "extracted-leveldb");
        const compileDest = join(COMPILE_OUTPUT_DIR, "recompiled-leveldb");

        await extractPack(db.path, extractDest, { clean: true });

        const extractedFiles = readdirSync(extractDest).filter((f) => f.endsWith(".json"));
        if (extractedFiles.length === 0) {
            throw new Error(
                `LevelDB extraction produced no files.\n` +
                `Source: ${db.path}\n` +
                `The LevelDB may be empty or corrupted.`,
            );
        }
        console.log(`Extracted ${extractedFiles.length} files from LevelDB for compilation`);

        await compilePack(extractDest, compileDest, { recursive: true });

        expect(existsSync(compileDest)).toBe(true);
    });
});
