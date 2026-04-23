import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PackToolsError } from "../error.js";

export function assertDocIdsStable(
    extractedDir: string,
    existingDir: string,
): { stable: boolean; mismatches: Array<{ file: string; extractedId: string; existingId: string }> } {
    const mismatches: Array<{ file: string; extractedId: string; existingId: string }> = [];
    const extractedFiles = enumerateJSON(extractedDir);
    for (const file of extractedFiles) {
        const relativePath = file.replace(extractedDir, "");
        const existingPath = join(existingDir, relativePath);
        if (!existsSync(existingPath)) continue;
        const extracted = JSON.parse(readFileSync(file, "utf-8")) as Record<string, unknown>;
        const existing = JSON.parse(readFileSync(existingPath, "utf-8")) as Record<string, unknown>;
        const extractedId = extracted["_id"] as string | undefined;
        const existingId = existing["_id"] as string | undefined;
        if (extractedId && existingId && extractedId !== existingId) {
            mismatches.push({ file: relativePath, extractedId, existingId });
        }
    }
    return { stable: mismatches.length === 0, mismatches };
}

function enumerateJSON(dir: string): string[] {
    const results: string[] = [];
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...enumerateJSON(fullPath));
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
            results.push(fullPath);
        }
    }
    return results;
}
