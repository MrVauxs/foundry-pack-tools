# @vauxs-fvtt/foundry-pack-tools

Document processing utilities for Foundry VTT compendium pack workflows. Build transform pipelines, clean HTML descriptions, normalize paths, convert UUIDs, and handle cross-system content migration.

## Installation

```bash
npm install @vauxs-fvtt/foundry-pack-tools
```

## Example Usage

### Extract & Compile Compendium Packs

*This is just a basic `foundryvtt-cli`, but might as well.*

```ts
import { extractPack, compilePack } from "@foundryvtt/foundryvtt-cli";

// Extract a LevelDB compendium pack into individual JSON files
await extractPack("packs/items", "output/extracted", { clean: true });

// Filter entries during extraction — return false to drop a document
await extractPack("packs/items", "output/filtered", {
    clean: true,
    transformEntry: async (entry) => {
        if (entry.type === "feat" && entry.name.includes("Test")) {
            return false;
        }
    },
});

// Compile JSON files back into a LevelDB pack
await compilePack("output/extracted", "packs/items-clean", { recursive: true });
```

### Build a Transform Pipeline with Built-in Plugins

Chain multiple transformations into a single `transformEntry` callback:

```ts
import {
    createTransformEntry,
    createClearFlagsPlugin,
    createCleanDescriptionHTMLPlugin,
    createNormalizeImagePathsPlugin,
    createPruneDefaultsPlugin,
    createValidateLinksPlugin,
} from "@vauxs-fvtt/foundry-pack-tools";
import { extractPack } from "@foundryvtt/foundryvtt-cli";

const transform = createTransformEntry([
    // Strip all document flags
    createClearFlagsPlugin(),

    // Cleanup HTML descriptions
    createCleanDescriptionHTMLPlugin(),

    // Normalize image paths — strip Forge VTT CDN prefix, prepend local system path
    createNormalizeImagePathsPlugin({
        gameSystemPath: "systems/my-system",
    }),

    // Remove default fields (sort, effects, _stats, null folder, default ownership)
    createPruneDefaultsPlugin({ normalizeOwnership: true }),

    // Reject any compendium links to systems other than sf2e
    createValidateLinksPlugin({
        allowedSystems: ["sf2e"],
    }),
]);

await extractPack("packs/items", "output/items-cleaned", {
    clean: true,
    transformEntry: transform,
});
```

### Selective Flag Preservation

Keep only specific flag scopes and optionally strip flags from embedded items:

```ts
import { createTransformEntry, createClearFlagsPlugin } from "@vauxs-fvtt/foundry-pack-tools";

const transform = createTransformEntry([
    createClearFlagsPlugin({
        allowScopes: ["core", "my-module"],
        stripEmbedded: true,
    }),
]);
```

### Standalone `cleanHTML`

Clean Foundry HTML — including Ancestry & Nations copypasta spans — while preserving HTML structure:

```ts
import { cleanHTML } from "@vauxs-fvtt/foundry-pack-tools";

const html = `
    <span data-aon-copypasta="true">garbage</span>
    <p>A <strong>bold</strong> ability with <em>italic</em> text.</p>
    <a href="https://example.com">link</a>
`;

const cleaned = cleanHTML(html);
// "<p>A <strong>bold</strong> ability with <em>italic</em> text.</p>\n<a href=\"https://example.com\">link</a>"
```

### UUID Conversion: Names ↔ IDs

Convert `@UUID[Compendium.pack.type.ID]` references to readable document names and back:

```ts
import {
    buildIdNameMap,
    createConvertUUIDsToNamesPlugin,
    createConvertUUIDsToIdsPlugin,
    createTransformEntry,
} from "@vauxs-fvtt/foundry-pack-tools";
import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { readFileSync } from "node:fs";

// Build a name lookup map from the extracted pack contents
const manifest = JSON.parse(readFileSync("system.json", "utf-8"));
const idNameMap = buildIdNameMap("packs", manifest);

// Replace @UUID references with document names
const toNames = createTransformEntry([
    createConvertUUIDsToNamesPlugin(idNameMap),
]);

await extractPack("packs/journal", "output/names", {
    clean: true,
    transformEntry: toNames,
});

// Replace names back to IDs (for re-import)
const toIds = createTransformEntry([
    createConvertUUIDsToIdsPlugin(idNameMap),
]);
```

### Cross-System Resolution

Map content from one game system to another — folders, packs, assets, flags, and UUIDs:

```ts
import {
    buildCompendiumRemap,
    createCrossSystemResolver,
} from "@vauxs-fvtt/foundry-pack-tools/cross-system";
import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { readFileSync } from "node:fs";

const sourceManifest = JSON.parse(readFileSync("sf2e/system.json", "utf-8"));
const targetManifest = JSON.parse(readFileSync("pf2e/system.json", "utf-8"));

// Auto-match packs by document type (e.g., sf2e.items → pf2e.items)
const remaps = buildCompendiumRemap(sourceManifest, targetManifest);

const resolver = createCrossSystemResolver({
    remaps,
    sourceFolders,                    // from source pack's folders.db.json
    targetFolders,                    // from target pack's folders.db.json
    assetPathReplacements: [
        { from: "systems/sf2e", to: "systems/pf2e" },
    ],
    flagScopeRename: { from: "sf2e", to: "pf2e" },
    uuidRemap,                        // Map<sourcePack, Map<oldId, newId>>
});

// Apply the resolver as a transform during extraction
await extractPack("sf2e/packs/items", "output/cross-system", {
    clean: true,
    transformEntry: (doc, ctx) => resolver.transform(doc, ctx),
});
```

### Utilities

```ts
import {
    prettyPrintPackJSON,
    sluggify,
    readPackJSON,
    getPackJSONPaths,
    PackToolsError,
} from "@vauxs-fvtt/foundry-pack-tools";

// Deterministic JSON — sorted keys, DocID keys at end, 4-space indent
const serialized = prettyPrintPackJSON(document);

// Generate slugs from names
const slug = sluggify("Longsword +1");  // "longsword-1"

// Enumerate all JSON files in an extracted pack
const paths = getPackJSONPaths("packs/items");
// ['packs/items/abc.json', 'packs/items/sub/def.json', ...]

// Read a single document with error handling
try {
    const doc = readPackJSON<PackEntry>(paths[0]);
} catch (err) {
    if (err instanceof PackToolsError) {
        console.error(err.message, err.cause);
    }
}
```

## API Summary

| Category                     | Exports                                                                                                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Error**                    | `PackToolsError`                                                                                                                                                                                                |
| **Pipeline**                 | `createTransformEntry`, `createClearFlagsPlugin`, `createCleanDescriptionHTMLPlugin`, `cleanHTML`, `createNormalizeImagePathsPlugin`, `createPruneDefaultsPlugin`, `createValidateLinksPlugin`, `LINK_PATTERNS` |
| **UUID**                     | `buildIdNameMap`, `convertUUIDsToNames`, `createConvertUUIDsToNamesPlugin`, `convertUUIDsToIds`, `createConvertUUIDsToIdsPlugin`                                                                                |
| **Utils**                    | `getPackJSONPaths`, `getFolderPath`, `readPackJSON`, `readFoldersFromPack`, `prettyPrintPackJSON`, `assertDocIdsStable`, `sluggify`                                                                             |
| **Types**                    | `PackEntry`, `ActorPackEntry`, `SystemPackEntry`, `TransformPlugin`, `TransformContext`, `PackMetadata`, `SystemManifest`, `DBFolder`                                                                           |
| **Cross-System** _(subpath)_ | `buildCompendiumRemap`, `createCrossSystemResolver`, `CompendiumRemap`, `CrossSystemResolverOptions`                                                                                                            |

### Cross-System Entrypoint

The cross-system module is a separate entrypoint to avoid pulling in extra dependencies when you only need the core utilities:

```ts
import { buildCompendiumRemap, createCrossSystemResolver } from "@vauxs-fvtt/foundry-pack-tools/cross-system";
```
