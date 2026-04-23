import type { PackEntry, TransformContext, TransformPlugin } from "../../types.js";

export const LINK_PATTERNS = [
    /@UUID\[(Compendium\.[^\]]+)\]/g,
    /@Compendium\[([^\]]+)\]/g,
    /@Actor\[([^\]]+)\]/g,
    /@Item\[([^\]]+)\]/g,
    /@Scene\[([^\]]+)\]/g,
    /@JournalEntry\[([^\]]+)\]/g,
    /@Macro\[([^\]]+)\]/g,
    /@RollTable\[([^\]]+)\]/g,
    /@Playlist\[([^\]]+)\]/g,
    /@Card\[([^\]]+)\]/g,
];

export interface ValidateLinksOptions {
    allowedSystems?: string[];
    warnOnly?: boolean;
}

export function createValidateLinksPlugin(options: ValidateLinksOptions = {}): TransformPlugin {
    const { allowedSystems = [], warnOnly = false } = options;
    return {
        name: "validateLinks",
        async transform(doc: PackEntry, _context: TransformContext) {
            const text = JSON.stringify(doc);
            for (const pattern of LINK_PATTERNS) {
                pattern.lastIndex = 0;
                let match;
                while ((match = pattern.exec(text)) !== null) {
                    const full = match[0];
                    if (allowedSystems.length > 0 && full.includes("Compendium.")) {
                        const compendiumPart = full.match(/Compendium\.([^./]+)/);
                        if (compendiumPart) {
                            const compendiumSystem = compendiumPart[1]?.split(".")[0];
                            if (compendiumSystem && !allowedSystems.includes(compendiumSystem)) {
                                const msg = `Link to disallowed system "${compendiumSystem}": ${full}`;
                                if (!warnOnly) {
                                    throw new Error(msg);
                                } else {
                                    console.warn(msg);
                                }
                            }
                        }
                    }
                }
            }
        },
    };
}
