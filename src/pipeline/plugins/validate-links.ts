import { PackToolsError } from "../../error.js";
import type { PackEntry, TransformContext, TransformPlugin } from "../../types.js";

export const LINK_PATTERNS = {
    world: [
        /@Actor\[([^\]]+)\]/g,
        /@Item\[([^\]]+)\]/g,
        /@Scene\[([^\]]+)\]/g,
        /@JournalEntry\[([^\]]+)\]/g,
        /@Macro\[([^\]]+)\]/g,
        /@RollTable\[([^\]]+)\]/g,
        /@Playlist\[([^\]]+)\]/g,
        /@Card\[([^\]]+)\]/g,
        /@Compendium\[world\.[^\]]+\]/g,
    ],
    compendium: [
        /@UUID\[Compendium\.([^\]]+)\]/g,
        /@Compendium\[(?!world\.)[^\]]+\]/g,
    ],
    uuid: [
        /@UUID\[([^\]]+)\]/g,
    ],
};

export interface ValidateLinksOptions {
    allowedSystems?: string[];
    warnOnly?: boolean;
}

const JOURNAL_ENTRY_PAGE_UUID = /@UUID\[JournalEntryPage\.[^\]]+\]/g;

function checkWorldLinks(text: string, warnOnly: boolean): void {
    for (const pattern of LINK_PATTERNS.world) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const full = match[0];
            const msg = `World-item links are not allowed: ${full}`;
            if (!warnOnly) {
                throw new PackToolsError(msg);
            } else {
                console.warn(msg);
            }
        }
    }
}

function checkCompendiumLinks(text: string, allowedSystems: string[], warnOnly: boolean): void {
    if (allowedSystems.length === 0) return;

    for (const pattern of LINK_PATTERNS.compendium) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const full = match[0];
            const compendiumPart = full.match(/Compendium\.([^./]+)/);
            if (compendiumPart) {
                const compendiumSystem = compendiumPart[1];
                if (compendiumSystem && !allowedSystems.includes(compendiumSystem)) {
                    const msg = `Link to disallowed system "${compendiumSystem}": ${full}`;
                    if (!warnOnly) {
                        throw new PackToolsError(msg);
                    } else {
                        console.warn(msg);
                    }
                }
            }
        }
    }
}

export function createValidateLinksPlugin(options: ValidateLinksOptions = {}): TransformPlugin {
    const { allowedSystems = [], warnOnly = false } = options;
    return {
        name: "validateLinks",
        async transform(doc: PackEntry, _context: TransformContext) {
            const text = JSON.stringify(doc);

            JOURNAL_ENTRY_PAGE_UUID.lastIndex = 0;
            const cleaned = text.replace(JOURNAL_ENTRY_PAGE_UUID, "");

            checkWorldLinks(cleaned, warnOnly);
            checkCompendiumLinks(cleaned, allowedSystems, warnOnly);
        },
    };
}
