import type { PackEntry, TransformContext } from "../types.js";

export interface ConvertUUIDsToIdsOptions {
    warnOnly?: boolean;
    nameIdMap?: Map<string, Map<string, string>>;
}

const UUID_NAME_PATTERN = /@UUID\[([^\]]+)\]/g;
const COMPENDIUM_NAME_PATTERN = /^(Compendium\.[^.]+)\.([^.]+)\.([^.]+)$/;

function buildNameToIdMap(idNameMap: Map<string, Map<string, string>>): Map<string, Map<string, string>> {
    const result = new Map<string, Map<string, string>>();
    for (const [packId, idToName] of idNameMap) {
        const nameToId = new Map<string, string>();
        for (const [id, name] of idToName) {
            nameToId.set(name.toLowerCase(), id);
        }
        result.set(packId, nameToId);
    }
    return result;
}

export function convertUUIDsToIds(
    doc: PackEntry,
    idNameMap: Map<string, Map<string, string>>,
    options: ConvertUUIDsToIdsOptions = {},
): void {
    const nameToIdMap = options.nameIdMap ?? buildNameToIdMap(idNameMap);
    const serialized = JSON.stringify(doc);
    const replaced = serialized.replace(UUID_NAME_PATTERN, (match, uuid) => {
        const nameMatch = COMPENDIUM_NAME_PATTERN.exec(uuid);
        if (!nameMatch) return match;
        const packId = nameMatch[1];
        const docName = nameMatch[3];
        if (!packId || !docName) return match;
        const packMap = nameToIdMap.get(packId);
        if (!packMap) return match;
        const id = packMap.get(docName.toLowerCase());
        if (!id) return match;
        return `${nameMatch[1]}.${nameMatch[2]}.${id}`;
    });

    const parsed = JSON.parse(replaced) as PackEntry;
    for (const key of Object.keys(parsed)) {
        (doc as Record<string, unknown>)[key] = (parsed as Record<string, unknown>)[key];
    }
}

export function createConvertUUIDsToIdsPlugin(
    idNameMap: Map<string, Map<string, string>>,
    options: ConvertUUIDsToIdsOptions = {},
) {
    return {
        name: "convertUUIDsToIds",
        async transform(doc: PackEntry, _context: TransformContext) {
            convertUUIDsToIds(doc, idNameMap, options);
        },
    };
}
