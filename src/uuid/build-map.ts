import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { SystemManifest } from "../types.js";

export function buildIdNameMap(
    packDir: string,
    manifest: SystemManifest,
): Map<string, Map<string, string>> {
    const result = new Map<string, Map<string, string>>();

    for (const pack of manifest.packs) {
        const packPath = join(packDir, pack.path);
        if (!existsSync(packPath)) continue;

        const packId = pack.id;
        const idToName = new Map<string, string>();
        const files = enumerateJSON(packPath);

        for (const file of files) {
            const raw = readFileSync(file, "utf-8");
            const entries = parseJSONEntries(raw);
            for (const entry of entries) {
                const id = entry._id as string | undefined;
                const name = entry.name as string | undefined;
                if (id && name) {
                    idToName.set(id, name);
                }
            }
        }

        result.set(packId, idToName);
    }

    return result;
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

function parseJSONEntries(raw: string): Array<Record<string, unknown>> {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>;
    if (typeof parsed === "object" && parsed !== null) return [parsed as Record<string, unknown>];
    return [];
}
