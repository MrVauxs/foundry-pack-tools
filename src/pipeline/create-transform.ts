import type { PackEntry, TransformContext, TransformPlugin } from "../types.js";

export function createTransformEntry(
    plugins: TransformPlugin[],
): (doc: PackEntry, context: TransformContext) => Promise<false | void> {
    return async (doc: PackEntry, context: TransformContext) => {
        for (const plugin of plugins) {
            const result = await plugin.transform(doc, context);
            if (result === false) return false;
        }
    };
}
