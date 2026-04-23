import type { PackEntry, TransformContext } from "../types.js";

export interface ConvertUUIDsToNamesOptions {
    warnOnly?: boolean;
    sessionIdMap?: Map<string, string>;
}

const UUID_PATTERN = /@UUID\[([^\]]+)\]/g;
const DOC_UUID_PATTERN = /^(Compendium\.[^.]+)\.([^.]+)\.([0-9a-zA-Z]{16,})$/;

export function convertUUIDsToNames(
    doc: PackEntry,
    idNameMap: Map<string, Map<string, string>>,
    options: ConvertUUIDsToNamesOptions = {},
): void {
    const { warnOnly = false, sessionIdMap } = options;
    const serialized = JSON.stringify(doc);
    const replaced = serialized.replace(UUID_PATTERN, (match, uuid) => {
        const docMatch = DOC_UUID_PATTERN.exec(uuid);
        if (!docMatch) return match;
        const packId = docMatch[1];
        const docId = docMatch[3];
        if (!packId || !docId) return match;
        let packMap = idNameMap.get(packId);
        if (!packMap && sessionIdMap) {
            const sessionName = sessionIdMap.get(docId);
            if (sessionName) return sessionName;
        }
        if (!packMap) {
            if (!warnOnly) {
                console.warn(`Unknown compendium pack: ${packId}`);
            }
            return match;
        }
        const name = packMap.get(docId);
        if (!name) {
            if (!warnOnly) {
                console.warn(`Unknown document ID: ${docId} in pack ${packId}`);
            }
            return match;
        }
        return name;
    });

    const cleaned = replaced.replace(/\[(@\w+\[[^\]]*\])\{[^}]*\}\]/g, "$1");

    const parsed = JSON.parse(cleaned) as PackEntry;
    for (const key of Object.keys(parsed)) {
        (doc as Record<string, unknown>)[key] = (parsed as Record<string, unknown>)[key];
    }
}

export function createConvertUUIDsToNamesPlugin(
    idNameMap: Map<string, Map<string, string>>,
    options: ConvertUUIDsToNamesOptions = {},
) {
    return {
        name: "convertUUIDsToNames",
        async transform(doc: PackEntry, _context: TransformContext) {
            convertUUIDsToNames(doc, idNameMap, options);
        },
    };
}
