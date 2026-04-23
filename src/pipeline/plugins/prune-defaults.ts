import type { PackEntry, TransformContext, TransformPlugin } from "../../types.js";

export interface PruneDefaultsOptions {
    topLevelFields?: string[];
    embeddedFields?: string[];
    normalizeOwnership?: boolean;
    defaultOwnership?: Record<string, number>;
}

const DEFAULT_TOP_LEVEL_FIELDS = ["sort", "effects", "_stats"];

export function createPruneDefaultsPlugin(options: PruneDefaultsOptions = {}): TransformPlugin {
    const {
        topLevelFields = DEFAULT_TOP_LEVEL_FIELDS,
        embeddedFields = [],
        normalizeOwnership = false,
        defaultOwnership = { default: 0 },
    } = options;

    return {
        name: "pruneDefaults",
        async transform(doc: PackEntry, _context: TransformContext) {
            for (const field of topLevelFields) {
                if (field in doc) {
                    delete (doc as Record<string, unknown>)[field];
                }
            }

            if (doc.folder === null || doc.folder === undefined) {
                delete doc.folder;
            }

            if (normalizeOwnership && doc.ownership) {
                const ownership = doc.ownership as Record<string, number>;
                const allDefault = Object.entries(ownership).every(
                    ([key, value]) => key === "default" || value === (defaultOwnership[key] ?? defaultOwnership["default"] ?? 0),
                );
                if (allDefault) {
                    delete doc.ownership;
                }
            }

            for (const embeddedField of embeddedFields) {
                const embedded = (doc as Record<string, unknown>)[embeddedField];
                if (Array.isArray(embedded)) {
                    for (const item of embedded) {
                        if (item && typeof item === "object") {
                            for (const field of topLevelFields) {
                                delete (item as Record<string, unknown>)[field];
                            }
                        }
                    }
                }
            }
        },
    };
}
