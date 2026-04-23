import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { extractPack, compilePack } from "@foundryvtt/foundryvtt-cli";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");
const EXTRACT_OUTPUT_DIR = join(import.meta.dirname, "output");
const COMPILE_OUTPUT_DIR = join(import.meta.dirname, "output-compile");

function findLevelDBDirectories(): Array<{ path: string; label: string }> {
    const results: Array<{ path: string; label: string }> = [];
    if (!existsSync(FIXTURES_DIR)) return results;
    const walk = (dir: string, baseName: string) => {
        const entries = readdirSync(dir);
        for (const entry of entries) {
            const full = join(dir, entry);
            const stats = statSync(full);
            if (stats.isDirectory()) {
                const isLevelDB = existsSync(join(full, "CURRENT"));
                if (isLevelDB) {
                    results.push({ path: full, label: entry });
                } else {
                    walk(full, `${baseName}/${entry}`);
                }
            }
        }
    };
    walk(FIXTURES_DIR, "fixtures");
    return results;
}

function reportDatabaseState(): void {
    const databases = findLevelDBDirectories();
    if (databases.length === 0) {
        console.log("No LevelDB packs found in", FIXTURES_DIR);
    } else {
        for (const db of databases) {
            console.log(`Found LevelDB: ${db.label} at ${db.path}`);
        }
    }
}

const packs = findLevelDBDirectories();

describe.sequential("pack fixtures", () => {
    beforeAll(() => {
        reportDatabaseState();
    });

    it("should find LevelDB packs in fixtures", () => {
        if (packs.length === 0) return;
        for (const db of packs) {
            expect(existsSync(db.path)).toBe(true);
        }
    });
});

describe.each(packs)("$label", (db) => {
    describe.sequential("extractPack", () => {
        beforeAll(() => {
            if (existsSync(EXTRACT_OUTPUT_DIR)) {
                rmSync(EXTRACT_OUTPUT_DIR, { recursive: true, force: true });
            }
            mkdirSync(EXTRACT_OUTPUT_DIR, { recursive: true });
        });

        afterAll(() => {
            if (existsSync(EXTRACT_OUTPUT_DIR)) {
                rmSync(EXTRACT_OUTPUT_DIR, { recursive: true, force: true });
            }
        });

        it("should extract a LevelDB pack to JSON files", async () => {
            const dest = join(EXTRACT_OUTPUT_DIR, db.label, "extracted");
            await extractPack(db.path, dest, { clean: true });

            expect(existsSync(dest)).toBe(true);
            const files = readdirSync(dest);
            if (files.length === 0) {
                throw new Error(
                    `LevelDB extraction produced no files.\n` +
                    `Source: ${db.path}\n` +
                    `Check that the LevelDB contains data and that extractPack is configured correctly.`,
                );
            }
            console.log(`[${db.label}] Extracted ${files.length} files from LevelDB`);
            const jsonFiles = files.filter((f) => f.endsWith(".json"));
            expect(jsonFiles.length).toBeGreaterThan(0);
        });

        it("should extract with a transformEntry function", async () => {
            const dest = join(EXTRACT_OUTPUT_DIR, db.label, "extracted-transformed");
            const transformed: string[] = [];

            await extractPack(db.path, dest, {
                clean: true,
                transformEntry: async (entry) => {
                    transformed.push(entry._id);
                },
            });

            expect(transformed.length).toBeGreaterThan(0);
        });

        it("should produce valid JSON files", async () => {
            const dest = join(EXTRACT_OUTPUT_DIR, db.label, "extracted-valid");
            await extractPack(db.path, dest, { clean: true });

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

        it("should extract then recompile a LevelDB pack", async () => {
            const extractDest = join(COMPILE_OUTPUT_DIR, db.label, "extracted");
            const compileDest = join(COMPILE_OUTPUT_DIR, db.label, "recompiled");

            await extractPack(db.path, extractDest, { clean: true });

            const extractedFiles = readdirSync(extractDest).filter((f) => f.endsWith(".json"));
            if (extractedFiles.length === 0) {
                throw new Error(
                    `Extraction produced no JSON files.\n` +
                    `Source: ${db.path}`,
                );
            }

            await compilePack(extractDest, compileDest, { recursive: true });

            expect(existsSync(compileDest)).toBe(true);
        });

        it("should compile with a transformEntry function", async () => {
            const extractDest = join(COMPILE_OUTPUT_DIR, db.label, "extracted-transform");
            const compileDest = join(COMPILE_OUTPUT_DIR, db.label, "recompiled-transform");

            await extractPack(db.path, extractDest, { clean: true });

            const transformed: string[] = [];

            await compilePack(extractDest, compileDest, {
                recursive: true,
                transformEntry: async (entry) => {
                    transformed.push(entry._id);
                },
            });

            expect(transformed.length).toBeGreaterThan(0);
        });

        it("should produce a valid LevelDB pack after compilation", async () => {
            const extractDest = join(COMPILE_OUTPUT_DIR, db.label, "extracted-valid");
            const compileDest = join(COMPILE_OUTPUT_DIR, db.label, "recompiled-valid");

            await extractPack(db.path, extractDest, { clean: true });
            await compilePack(extractDest, compileDest, { recursive: true });

            expect(existsSync(compileDest)).toBe(true);

            const dbFiles = readdirSync(compileDest);
            const hasCurrent = dbFiles.includes("CURRENT");
            const hasManifest = dbFiles.some((f) => f.startsWith("MANIFEST-"));
            if (!hasCurrent || !hasManifest) {
                throw new Error(
                    `Compiled LevelDB is missing required files.\n` +
                    `Files found: ${dbFiles.join(", ")}\n` +
                    `Expected CURRENT and MANIFEST-* files.`,
                );
            }
        });

        it("should roundtrip data correctly", async () => {
            const extractDest = join(COMPILE_OUTPUT_DIR, db.label, "extracted-roundtrip");
            const compileDest = join(COMPILE_OUTPUT_DIR, db.label, "recompiled-roundtrip");
            const reextractDest = join(COMPILE_OUTPUT_DIR, db.label, "reextracted");

            await extractPack(db.path, extractDest, { clean: true });
            await compilePack(extractDest, compileDest, { recursive: true });
            await extractPack(compileDest, reextractDest, { clean: true });

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
    });
});
