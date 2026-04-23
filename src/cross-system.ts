import type { DBFolder, PackEntry, SystemManifest, TransformContext } from "./types.js";
import { getFolderPath } from "./utils/fs.js";

export interface CompendiumRemap {
    sourcePackId: string;
    targetPackId: string;
    documentType: string;
}

export function buildCompendiumRemap(
    sourceManifest: SystemManifest,
    targetManifest: SystemManifest,
): CompendiumRemap[] {
    const remaps: CompendiumRemap[] = [];
    for (const sourcePack of sourceManifest.packs) {
        for (const targetPack of targetManifest.packs) {
            if (sourcePack.type === targetPack.type) {
                remaps.push({
                    sourcePackId: sourcePack.id,
                    targetPackId: targetPack.id,
                    documentType: sourcePack.type ?? "unknown",
                });
            }
        }
    }
    return remaps;
}

export interface CrossSystemResolverOptions {
    remaps: CompendiumRemap[];
    sourceFolders: DBFolder[];
    targetFolders: DBFolder[];
    assetPathReplacements?: Array<{ from: string; to: string }>;
    flagScopeRename?: { from: string; to: string };
    uuidRemap?: Map<string, Map<string, string>>;
}

export function createCrossSystemResolver(options: CrossSystemResolverOptions) {
    const {
        remaps,
        sourceFolders,
        targetFolders,
        assetPathReplacements = [],
        flagScopeRename,
        uuidRemap,
    } = options;

    const folderPathMap = buildFolderPathMap(sourceFolders, targetFolders);
    const packRemapMap = new Map<string, CompendiumRemap>();
    for (const remap of remaps) {
        packRemapMap.set(remap.sourcePackId, remap);
    }

    return {
        resolveFolderId(sourceFolderId: string): string | null {
            const path = folderPathMap.get(sourceFolderId);
            if (!path) return null;
            const target = targetFolders.find((f) => getFolderPathRaw(f, targetFolders).toLowerCase() === path);
            return target?._id ?? null;
        },

        resolvePackId(sourcePackId: string): string | null {
            return packRemapMap.get(sourcePackId)?.targetPackId ?? null;
        },

        transformAssetPath(path: string): string {
            let result = path;
            for (const replacement of assetPathReplacements) {
                if (result.startsWith(replacement.from)) {
                    result = replacement.to + result.slice(replacement.from.length);
                }
            }
            return result;
        },

        transformFlags(flags: Record<string, Record<string, unknown>>): Record<string, Record<string, unknown>> {
            const result: Record<string, Record<string, unknown>> = {};
            for (const [scope, data] of Object.entries(flags)) {
                const newScope = scope === flagScopeRename?.from ? flagScopeRename.to : scope;
                result[newScope] = data;
            }
            return result;
        },

        transformUUID(uuid: string): string {
            if (!uuidRemap) return uuid;
            const match = /^(Compendium\.[^.]+)\.([^.]+)\.([0-9a-zA-Z]{16,})$/.exec(uuid);
            if (!match) return uuid;
            const packId = match[1];
            const docId = match[3];
            if (!packId || !docId) return uuid;
            const remappedPack = packRemapMap.get(packId);
            const newPackId = remappedPack?.targetPackId ?? packId;
            const packDocMap = uuidRemap.get(packId);
            const newDocId = packDocMap?.get(docId) ?? docId;
            return `${newPackId}.${match[2]}.${newDocId}`;
        },

        async transform(doc: PackEntry, _context: TransformContext): Promise<false | void> {
            if (doc.folder) {
                const newFolderId = this.resolveFolderId(doc.folder);
                if (newFolderId) {
                    doc.folder = newFolderId;
                }
            }

            if (doc.flags) {
                doc.flags = this.transformFlags(doc.flags);
            }

            const serialized = JSON.stringify(doc);
            const replaced = serialized.replace(
                /@UUID\[([^\]]+)\]/g,
                (_match, uuid) => `@UUID[${this.transformUUID(uuid)}]`,
            );

            let assetReplaced = replaced;
            for (const rep of assetPathReplacements) {
                assetReplaced = assetReplaced.replaceAll(rep.from, rep.to);
            }

            const parsed = JSON.parse(assetReplaced) as PackEntry;
            for (const key of Object.keys(parsed)) {
                (doc as Record<string, unknown>)[key] = (parsed as Record<string, unknown>)[key];
            }
        },
    };
}

function buildFolderPathMap(
    sourceFolders: DBFolder[],
    targetFolders: DBFolder[],
): Map<string, string> {
    const map = new Map<string, string>();
    for (const folder of sourceFolders) {
        const path = getFolderPathRaw(folder, sourceFolders).toLowerCase();
        map.set(folder._id, path);
    }
    return map;
}

function getFolderPathRaw(folder: DBFolder, allFolders: DBFolder[]): string {
    const parts: string[] = [];
    let current: DBFolder | undefined = folder;
    while (current) {
        parts.unshift(current.name);
        if (!current.parent) break;
        current = allFolders.find((f) => f._id === current?.parent);
    }
    return parts.join("/");
}
