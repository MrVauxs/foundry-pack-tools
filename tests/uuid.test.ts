import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    convertUUIDsToNames,
    convertUUIDsToIds,
    createConvertUUIDsToNamesPlugin,
    createConvertUUIDsToIdsPlugin,
} from "../src/uuid/index.js";
import type { PackEntry, TransformContext } from "../src/types.js";

function makeDoc(overrides: Partial<PackEntry> = {}): PackEntry {
    return {
        _id: "test12345678901234",
        name: "Test Document",
        type: "item",
        ...overrides,
    };
}

const emptyContext: TransformContext = {};

describe("convertUUIDsToNames", () => {
    const idNameMap = new Map<string, Map<string, string>>([
        ["Compendium.dnd5e", new Map([
            ["abcdefghijklmnop", "Longsword"],
            ["qrstuvwxyz123456", "Shield"],
        ])],
    ]);

    it("replaces @UUID with document name", () => {
        const doc = makeDoc({
            system: { description: { value: '@UUID[Compendium.dnd5e.items.abcdefghijklmnop]' } },
        });
        convertUUIDsToNames(doc, idNameMap);
        expect((doc.system as any).description.value).toBe("Longsword");
    });

    it("leaves unmatched UUID unchanged", () => {
        const doc = makeDoc({
            system: { description: { value: '@UUID[Compendium.unknown.items.abcdefghijklmnop]' } },
        });
        convertUUIDsToNames(doc, idNameMap);
        expect((doc.system as any).description.value).toContain("@UUID");
    });

    it("warns on unknown pack", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const doc = makeDoc({
            system: { description: { value: '@UUID[Compendium.nonexistent.items.abcdefghijklmnop]' } },
        });
        convertUUIDsToNames(doc, idNameMap);
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("warns on unknown document ID", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const doc = makeDoc({
            system: { description: { value: '@UUID[Compendium.dnd5e.items.zzzzzzzzzzzzzzzz]' } },
        });
        convertUUIDsToNames(doc, idNameMap);
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("does not warn in warnOnly mode", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const doc = makeDoc({
            system: { description: { value: '@UUID[Compendium.nonexistent.items.abcdefghijklmnop]' } },
        });
        convertUUIDsToNames(doc, idNameMap, { warnOnly: true });
        expect(warnSpy).not.toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("handles multiple UUIDs in the same document", () => {
        const doc = makeDoc({
            system: {
                description: {
                    value: '@UUID[Compendium.dnd5e.items.abcdefghijklmnop] and @UUID[Compendium.dnd5e.items.qrstuvwxyz123456]',
                },
            },
        });
        convertUUIDsToNames(doc, idNameMap);
        expect((doc.system as any).description.value).toBe("Longsword and Shield");
    });

    it("cleans up format suffix braces", () => {
        const doc = makeDoc({
            system: { description: { value: '[@UUID[Compendium.dnd5e.items.abcdefghijklmnop]{Longsword}]' } },
        });
        convertUUIDsToNames(doc, idNameMap);
        expect((doc.system as any).description.value).toBe("[Longsword{Longsword}]");
    });
});

describe("convertUUIDsToIds", () => {
    const idNameMap = new Map<string, Map<string, string>>([
        ["Compendium.dnd5e", new Map([
            ["abcdefghijklmnop", "Longsword"],
            ["qrstuvwxyz123456", "Shield"],
        ])],
    ]);

    it("replaces document name with ID", () => {
        const doc = makeDoc({
            system: { description: { value: '@UUID[Compendium.dnd5e.items.Longsword]' } },
        });
        convertUUIDsToIds(doc, idNameMap);
        expect((doc.system as any).description.value).toBe("Compendium.dnd5e.items.abcdefghijklmnop");
    });

    it("is case-insensitive for names", () => {
        const doc = makeDoc({
            system: { description: { value: '@UUID[Compendium.dnd5e.items.longsword]' } },
        });
        convertUUIDsToIds(doc, idNameMap);
        expect((doc.system as any).description.value).toBe("Compendium.dnd5e.items.abcdefghijklmnop");
    });

    it("leaves unmatched name unchanged", () => {
        const doc = makeDoc({
            system: { description: { value: '@UUID[Compendium.dnd5e.items.UnknownItem]' } },
        });
        convertUUIDsToIds(doc, idNameMap);
        expect((doc.system as any).description.value).toContain("UnknownItem");
    });

    it("uses custom nameIdMap when provided", () => {
        const customMap = new Map<string, Map<string, string>>([
            ["Compendium.pf2e", new Map([
                ["custom weapon", "custom-id-1234"],
            ])],
        ]);
        const doc = makeDoc({
            system: { description: { value: '@UUID[Compendium.pf2e.items.Custom Weapon]' } },
        });
        convertUUIDsToIds(doc, idNameMap, { nameIdMap: customMap });
        expect((doc.system as any).description.value).toBe("Compendium.pf2e.items.custom-id-1234");
    });
});

describe("createConvertUUIDsToNamesPlugin", () => {
    const idNameMap = new Map<string, Map<string, string>>([
        ["Compendium.dnd5e", new Map([
            ["abcdefghijklmnop", "Longsword"],
        ])],
    ]);

    it("creates a plugin that converts to names", async () => {
        const plugin = createConvertUUIDsToNamesPlugin(idNameMap);
        expect(plugin.name).toBe("convertUUIDsToNames");
        const doc = makeDoc({
            system: { description: { value: '@UUID[Compendium.dnd5e.items.abcdefghijklmnop]' } },
        });
        await plugin.transform(doc, emptyContext);
        expect((doc.system as any).description.value).toBe("Longsword");
    });
});

describe("createConvertUUIDsToIdsPlugin", () => {
    const idNameMap = new Map<string, Map<string, string>>([
        ["Compendium.dnd5e", new Map([
            ["abcdefghijklmnop", "Longsword"],
        ])],
    ]);

    it("creates a plugin that converts to IDs", async () => {
        const plugin = createConvertUUIDsToIdsPlugin(idNameMap);
        expect(plugin.name).toBe("convertUUIDsToIds");
        const doc = makeDoc({
            system: { description: { value: '@UUID[Compendium.dnd5e.items.Longsword]' } },
        });
        await plugin.transform(doc, emptyContext);
        expect((doc.system as any).description.value).toBe("Compendium.dnd5e.items.abcdefghijklmnop");
    });
});
