import { describe, it, expect } from "vitest";
import {
    buildCompendiumRemap,
    createCrossSystemResolver,
} from "../src/cross-system.js";
import type { DBFolder, PackEntry, SystemManifest, TransformContext } from "../src/types.js";

function makeDoc(overrides: Partial<PackEntry> = {}): PackEntry {
    return {
        _id: "test12345678901234",
        name: "Test Document",
        type: "item",
        ...overrides,
    };
}

const emptyContext: TransformContext = {};

describe("buildCompendiumRemap", () => {
    const sourceManifest: SystemManifest = {
        id: "dnd5e",
        name: "D&D 5e",
        version: "3.0.0",
        title: "D&D 5e",
        description: "",
        authors: [],
        systems: [],
        compatibility: { minimum: "12", verified: "12" },
        packs: [
            { id: "dnd5e.items", label: "Items", path: "packs/items", type: "Item" },
            { id: "dnd5e.spells", label: "Spells", path: "packs/spells", type: "Spell" },
        ],
        esmodules: [],
        styles: [],
    };

    const targetManifest: SystemManifest = {
        id: "pf2e",
        name: "PF2e",
        version: "6.0.0",
        title: "Pathfinder 2e",
        description: "",
        authors: [],
        systems: [],
        compatibility: { minimum: "12", verified: "12" },
        packs: [
            { id: "pf2e.items", label: "Equipment", path: "packs/equipment", type: "Item" },
            { id: "pf2e.spells", label: "Spells", path: "packs/spells", type: "Spell" },
        ],
        esmodules: [],
        styles: [],
    };

    it("matches packs by type", () => {
        const remaps = buildCompendiumRemap(sourceManifest, targetManifest);
        expect(remaps).toHaveLength(2);
        const itemsToItems = remaps.find(
            (r) => r.sourcePackId === "dnd5e.items" && r.targetPackId === "pf2e.items"
        );
        expect(itemsToItems).toBeDefined();
        expect(itemsToItems?.documentType).toBe("Item");
    });

    it("returns empty array when no matches", () => {
        const unrelated: SystemManifest = {
            ...targetManifest,
            packs: [{ id: "pf2e.scenes", label: "Scenes", path: "packs/scenes", type: "Scene" }],
        };
        const remaps = buildCompendiumRemap(sourceManifest, unrelated);
        expect(remaps).toHaveLength(0);
    });

    it("cross-matches all type-compatible packs", () => {
        const remaps = buildCompendiumRemap(sourceManifest, targetManifest);
        const spellRemaps = remaps.filter((r) => r.documentType === "Spell");
        expect(spellRemaps.length).toBeGreaterThanOrEqual(1);
    });
});

describe("createCrossSystemResolver", () => {
    const sourceFolders: DBFolder[] = [
        { _id: "sf1", name: "Weapons", type: "Item", sort: 0, color: null, parent: null, flags: {}, _stats: {} },
        { _id: "sf2", name: "Melee", type: "Item", sort: 0, color: null, parent: "sf1", flags: {}, _stats: {} },
    ];

    const targetFolders: DBFolder[] = [
        { _id: "tf1", name: "weapons", type: "Item", sort: 0, color: null, parent: null, flags: {}, _stats: {} },
        { _id: "tf2", name: "melee", type: "Item", sort: 0, color: null, parent: "tf1", flags: {}, _stats: {} },
    ];

    const remaps = [
        { sourcePackId: "Compendium.dnd5e", targetPackId: "Compendium.pf2e", documentType: "Item" },
    ];

    it("resolves folder ID by path", () => {
        const resolver = createCrossSystemResolver({ remaps, sourceFolders, targetFolders });
        const result = resolver.resolveFolderId("sf2");
        expect(result).toBe("tf2");
    });

    it("returns null for unknown folder ID", () => {
        const resolver = createCrossSystemResolver({ remaps, sourceFolders, targetFolders });
        const result = resolver.resolveFolderId("unknown");
        expect(result).toBeNull();
    });

    it("remaps pack ID", () => {
        const resolver = createCrossSystemResolver({ remaps, sourceFolders, targetFolders });
        const result = resolver.resolvePackId("Compendium.dnd5e");
        expect(result).toBe("Compendium.pf2e");
    });

    it("returns null for unknown pack ID", () => {
        const resolver = createCrossSystemResolver({ remaps, sourceFolders, targetFolders });
        const result = resolver.resolvePackId("Compendium.unknown");
        expect(result).toBeNull();
    });

    it("replaces asset paths", () => {
        const resolver = createCrossSystemResolver({
            remaps,
            sourceFolders,
            targetFolders,
            assetPathReplacements: [{ from: "systems/dnd5e", to: "systems/pf2e" }],
        });
        const result = resolver.transformAssetPath("systems/dnd5e/assets/icon.webp");
        expect(result).toBe("systems/pf2e/assets/icon.webp");
    });

    it("renames flag scopes", () => {
        const resolver = createCrossSystemResolver({
            remaps,
            sourceFolders,
            targetFolders,
            flagScopeRename: { from: "dnd5e", to: "pf2e" },
        });
        const result = resolver.transformFlags({ dnd5e: { someFlag: true }, other: { x: 1 } });
        expect(result).toEqual({ pf2e: { someFlag: true }, other: { x: 1 } });
    });

    it("remaps UUIDs", () => {
        const uuidRemap = new Map<string, Map<string, string>>([
            ["Compendium.dnd5e", new Map([
                ["oldid123456789012", "newid123456789012"],
            ])],
        ]);
        const resolver = createCrossSystemResolver({
            remaps,
            sourceFolders,
            targetFolders,
            uuidRemap,
        });
        const result = resolver.transformUUID("Compendium.dnd5e.items.oldid123456789012");
        expect(result).toBe("Compendium.pf2e.items.newid123456789012");
    });

    it("leaves UUID unchanged when no uuidRemap", () => {
        const resolver = createCrossSystemResolver({ remaps, sourceFolders, targetFolders });
        const result = resolver.transformUUID("Compendium.dnd5e.items.abcdefghijklmnop");
        expect(result).toBe("Compendium.dnd5e.items.abcdefghijklmnop");
    });

    it("full transform integrates folder, flags, and UUID remapping", async () => {
        const uuidRemap = new Map<string, Map<string, string>>([
            ["Compendium.dnd5e", new Map([
                ["test12345678901234", "newid1234567890ab"],
            ])],
        ]);
        const resolver = createCrossSystemResolver({
            remaps,
            sourceFolders,
            targetFolders,
            assetPathReplacements: [{ from: "systems/dnd5e", to: "systems/pf2e" }],
            flagScopeRename: { from: "dnd5e", to: "pf2e" },
            uuidRemap,
        });

        const doc = makeDoc({
            folder: "sf1",
            flags: { dnd5e: { someFlag: true } },
            img: "systems/dnd5e/assets/icon.webp",
            system: { description: { value: '@UUID[Compendium.dnd5e.items.test12345678901234]' } },
        });

        await resolver.transform(doc, emptyContext);

        expect(doc.folder).toBe("tf1");
        expect(doc.flags).toEqual({ pf2e: { someFlag: true } });
        expect(doc.img).toBe("systems/pf2e/assets/icon.webp");
        expect((doc.system as any).description.value).toBe("@UUID[Compendium.pf2e.items.newid1234567890ab]");
    });

    it("transform does nothing when folder is missing", async () => {
        const resolver = createCrossSystemResolver({ remaps, sourceFolders, targetFolders });
        const doc = makeDoc({ folder: undefined });
        await resolver.transform(doc, emptyContext);
        expect(doc.folder).toBeUndefined();
    });

    it("transform does nothing when flags are missing", async () => {
        const resolver = createCrossSystemResolver({ remaps, sourceFolders, targetFolders });
        const doc = makeDoc({ flags: undefined });
        await resolver.transform(doc, emptyContext);
        expect(doc.flags).toBeUndefined();
    });
});
