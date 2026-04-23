import { existsSync } from "node:fs";
import { PackToolsError } from "../../error.js";
import type { PackEntry, TransformContext, TransformPlugin } from "../../types.js";

export interface NormalizeImagesOptions {
    validateDisk?: boolean;
    gameSystemPath?: string;
}

const FORGE_VTT_PREFIXES = [
    "https://assets.forge-vtt.com/bazaar/assets/",
    "https://assets.forge-vtt.com/",
];

export function createNormalizeImagePathsPlugin(options: NormalizeImagesOptions = {}): TransformPlugin {
    const { validateDisk = false, gameSystemPath } = options;
    return {
        name: "normalizeImagePaths",
        async transform(doc: PackEntry, _context: TransformContext) {
            if (doc.img) {
                doc.img = normalizeImagePath(doc.img, validateDisk, gameSystemPath);
            }
            const system = doc.system as Record<string, unknown> | undefined;
            if (system) {
                normalizeObjectImages(system, validateDisk, gameSystemPath);
            }
        },
    };
}

function normalizeImagePath(
    path: string,
    validateDisk: boolean,
    gameSystemPath?: string,
): string {
    for (const prefix of FORGE_VTT_PREFIXES) {
        if (path.startsWith(prefix)) {
            path = path.slice(prefix.length);
            if (gameSystemPath) {
                path = `${gameSystemPath}/${path}`;
            }
            break;
        }
    }

    if (path.startsWith("data:")) {
        throw new PackToolsError("Base64 data URIs are not allowed for image paths");
    }

    if (path) {
        const lower = path.toLowerCase();
        if (!lower.endsWith(".webp") && !lower.endsWith(".svg") && !lower.endsWith(".png") && !lower.endsWith(".jpg") && !lower.endsWith(".jpeg") && !lower.endsWith(".gif")) {
            throw new PackToolsError(`Invalid image extension: ${path}`);
        }
    }

    if (validateDisk && path && gameSystemPath && !path.startsWith("http")) {
        if (!existsSync(path)) {
            throw new PackToolsError(`Image file not found: ${path}`);
        }
    }

    return path;
}

function normalizeObjectImages(
    obj: Record<string, unknown>,
    validateDisk: boolean,
    gameSystemPath?: string,
): void {
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string" && (key.endsWith("Img") || key === "img" || key === "image")) {
            obj[key] = normalizeImagePath(value, validateDisk, gameSystemPath);
        } else if (value && typeof value === "object" && !Array.isArray(value)) {
            normalizeObjectImages(value as Record<string, unknown>, validateDisk, gameSystemPath);
        }
    }
}
