import type { PackEntry, TransformContext, TransformPlugin } from "../../types.js";

export interface ClearFlagsOptions {
    allowScopes?: string[];
    stripEmbedded?: boolean;
}

export function createClearFlagsPlugin(options: ClearFlagsOptions = {}): TransformPlugin {
    const { allowScopes = [], stripEmbedded = false } = options;
    const allowed = new Set(allowScopes);
    return {
        name: "clearFlags",
        async transform(doc: PackEntry, _context: TransformContext) {
            if (doc.flags) {
                const filtered: Record<string, Record<string, unknown>> = {};
                for (const [scope, flags] of Object.entries(doc.flags)) {
                    if (allowed.size === 0 || allowed.has(scope)) {
                        filtered[scope] = flags;
                    }
                }
                doc.flags = Object.keys(filtered).length > 0 ? filtered : undefined;
            }
            if (stripEmbedded && Array.isArray((doc as Record<string, unknown>).items)) {
                for (const item of (doc as Record<string, unknown>).items as PackEntry[]) {
                    delete item.flags;
                }
            }
        },
    };
}
