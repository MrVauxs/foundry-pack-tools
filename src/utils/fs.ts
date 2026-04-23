import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PackToolsError } from "../error.js";
import type { DBFolder, TransformContext } from "../types.js";

export function getPackJSONPaths(
    packDir: string,
    baseDir?: string,
): string[] {
    const resolved = baseDir ? join(packDir, baseDir) : packDir;
    if (!existsSync(resolved)) {
        throw new PackToolsError(`Pack directory does not exist: ${resolved}`);
    }
    return enumerateJSON(resolved);
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

export function getFolderPath(
    context: TransformContext,
    folder: DBFolder | null | undefined,
    folders: DBFolder[],
): string {
    if (!folder) return "";
    const parts: string[] = [];
    let current: DBFolder | undefined = folder;
    while (current) {
        parts.unshift(current.name);
        if (!current.parent) break;
        current = folders.find((f) => f._id === current?.parent);
    }
    return parts.join("/").toLowerCase();
}

export function readPackJSON<T = Record<string, unknown>>(filePath: string): T {
    if (!existsSync(filePath)) {
        throw new PackToolsError(`File does not exist: ${filePath}`);
    }
    const raw = readFileSync(filePath, "utf-8");
    try {
        return JSON.parse(raw) as T;
    } catch (cause) {
        throw new PackToolsError(`Invalid JSON in ${filePath}`, cause as Error);
    }
}

export function readFoldersFromPack(packDir: string): DBFolder[] {
    const foldersPath = join(packDir, "folders.db.json");
    if (!existsSync(foldersPath)) {
        return [];
    }
    const raw = readFileSync(foldersPath, "utf-8");
    const parsed = JSON.parse(raw) as DBFolder[];
    return Array.isArray(parsed) ? parsed : [];
}
