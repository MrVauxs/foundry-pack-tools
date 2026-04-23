import { describe, it, expect, vi, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import {
    createTransformEntry,
    createClearFlagsPlugin,
    cleanHTML,
    createCleanDescriptionHTMLPlugin,
    createNormalizeImagePathsPlugin,
    createPruneDefaultsPlugin,
    createValidateLinksPlugin,
    LINK_PATTERNS,
} from "../src/pipeline/index.js";
import { PackToolsError } from "../src/error.js";
import type { PackEntry, TransformContext, TransformPlugin } from "../src/types.js";

function makeDoc<T extends Partial<PackEntry>>(overrides?: T) {
    return {
        _id: "test12345678901234",
        name: "Test Document",
        type: "item",
        ...(overrides ?? {}),
    } as PackEntry & NonNullable<T>;
}

const emptyContext: TransformContext = {};

describe("createTransformEntry", () => {
    it("runs all plugins in order", async () => {
        const order: string[] = [];
        const plugin1: TransformPlugin = {
            name: "p1",
            async transform() { order.push("p1"); },
        };
        const plugin2: TransformPlugin = {
            name: "p2",
            async transform() { order.push("p2"); },
        };

        const transform = createTransformEntry([plugin1, plugin2]);
        await transform(makeDoc(), emptyContext);
        expect(order).toEqual(["p1", "p2"]);
    });

    it("short-circuits when a plugin returns false", async () => {
        const order: string[] = [];
        const plugin1: TransformPlugin = {
            name: "p1",
            async transform() { order.push("p1"); return false; },
        };
        const plugin2: TransformPlugin = {
            name: "p2",
            async transform() { order.push("p2"); },
        };

        const transform = createTransformEntry([plugin1, plugin2]);
        const result = await transform(makeDoc(), emptyContext);
        expect(order).toEqual(["p1"]);
        expect(result).toBe(false);
    });

    it("mutates doc in-place", async () => {
        const plugin: TransformPlugin = {
            name: "mutator",
            async transform(doc) {
                doc.name = "mutated";
            },
        };
        const doc = makeDoc();
        const transform = createTransformEntry([plugin]);
        await transform(doc, emptyContext);
        expect(doc.name).toBe("mutated");
    });
});

describe("createClearFlagsPlugin", () => {
    it("keeps all flags when no allowScopes provided", async () => {
        const plugin = createClearFlagsPlugin();
        const doc = makeDoc({
            flags: { core: { someFlag: true }, "some-module": { other: 1 } },
        });
        await plugin.transform(doc, emptyContext);
        expect(doc.flags).toEqual({ core: { someFlag: true }, "some-module": { other: 1 } });
    });

    it("keeps allowed scopes", async () => {
        const plugin = createClearFlagsPlugin({ allowScopes: ["core"] });
        const doc = makeDoc({
            flags: { core: { someFlag: true }, "some-module": { other: 1 } },
        });
        await plugin.transform(doc, emptyContext);
        expect(doc.flags).toEqual({ core: { someFlag: true } });
    });

    it("keeps all scopes when allowlist is empty but not undefined", async () => {
        const plugin = createClearFlagsPlugin({ allowScopes: [] });
        const doc = makeDoc({
            flags: { core: { someFlag: true } },
        });
        await plugin.transform(doc, emptyContext);
        expect(doc.flags).toEqual({ core: { someFlag: true } });
    });

    it("strips embedded flags when stripEnabled", async () => {
        const plugin = createClearFlagsPlugin({ stripEmbedded: true });
        const doc = makeDoc({
            flags: { core: { flag: true } },
            items: [
                { _id: "item1", name: "Item", type: "weapon", flags: { core: { x: 1 } } } as PackEntry,
            ],
        });
        await plugin.transform(doc, emptyContext);
        expect(doc.flags).toEqual({ core: { flag: true } });
        expect((doc.items![0] as PackEntry).flags).toBeUndefined();
    });
});

describe("cleanHTML", () => {
    it("strips AoN copypasta spans", () => {
        const html = '<span data-aon-copypasta="true">garbage</span><p>content</p>';
        const result = cleanHTML(html);
        expect(result).not.toContain("data-aon-copypasta");
        expect(result).toContain("garbage");
    });

    it("converts br to newline", () => {
        const html = "line1<br/>line2";
        const result = cleanHTML(html);
        expect(result).toContain("\n");
    });

    it("converts p tags to newlines", () => {
        const html = "<p>para1</p><p>para2</p>";
        const result = cleanHTML(html);
        expect(result).toContain("para1");
        expect(result).toContain("para2");
    });

    it("converts strong/b to markdown bold", () => {
        const html = "<strong>bold</strong><b>also bold</b>";
        const result = cleanHTML(html);
        expect(result).toContain("**bold**");
        expect(result).toContain("**also bold**");
    });

    it("converts em/i to markdown italic", () => {
        const html = "<em>italic</em><i>also italic</i>";
        const result = cleanHTML(html);
        expect(result).toContain("*italic*");
        expect(result).toContain("*also italic*");
    });

    it("converts links to markdown", () => {
        const html = '<a href="https://example.com">link</a>';
        const result = cleanHTML(html);
        expect(result).toContain("[link](https://example.com)");
    });

    it("decodes HTML entities", () => {
        const html = "&lt;tag&gt; &amp; &nbsp; &#65;";
        const result = cleanHTML(html);
        expect(result).toContain("<tag>");
        expect(result).toContain("&");
        expect(result).toContain("A");
    });

    it("normalizes whitespace", () => {
        const html = "  spaced   out  ";
        const result = cleanHTML(html);
        expect(result).toBe("spaced out");
    });

    it("collapses multiple newlines", () => {
        const html = "<p>a</p><p>b</p><p>c</p>";
        const result = cleanHTML(html);
        expect(result).not.toMatch(/\n{3,}/);
    });
});

describe("createCleanDescriptionHTMLPlugin", () => {
    it("cleans description.value", async () => {
        const plugin = createCleanDescriptionHTMLPlugin();
        const doc = makeDoc({
            system: {
                description: { value: "<p>hello</p>" },
            },
        });
        await plugin.transform(doc, emptyContext);
        expect((doc.system as any).description.value).toBe("hello");
    });

    it("cleans description.chat", async () => {
        const plugin = createCleanDescriptionHTMLPlugin();
        const doc = makeDoc({
            system: {
                description: { chat: "<strong>chat</strong>" },
            },
        });
        await plugin.transform(doc, emptyContext);
        expect((doc.system as any).description.chat).toBe("**chat**");
    });

    it("cleans description.unidentified", async () => {
        const plugin = createCleanDescriptionHTMLPlugin();
        const doc = makeDoc({
            system: {
                description: { unidentified: "<em>secret</em>" },
            },
        });
        await plugin.transform(doc, emptyContext);
        expect((doc.system as any).description.unidentified).toBe("*secret*");
    });

    it("does nothing when system is missing", async () => {
        const plugin = createCleanDescriptionHTMLPlugin();
        const doc = makeDoc({ system: undefined });
        await plugin.transform(doc, emptyContext);
        expect(doc.system).toBeUndefined();
    });
});

describe("createNormalizeImagePathsPlugin", () => {
    it("strips Forge VTT prefix", async () => {
        const plugin = createNormalizeImagePathsPlugin({ gameSystemPath: "systems/dnd5e" });
        const doc = makeDoc({
            img: "https://assets.forge-vtt.com/bazaar/assets/path/icon.webp",
        });
        await plugin.transform(doc, emptyContext);
        expect(doc.img).toBe("systems/dnd5e/path/icon.webp");
    });

    it("rejects data URIs", async () => {
        const plugin = createNormalizeImagePathsPlugin();
        const doc = makeDoc({ img: "data:image/png;base64,abc" });
        await expect(plugin.transform(doc, emptyContext)).rejects.toThrow(PackToolsError);
    });

    it("rejects invalid extensions", async () => {
        const plugin = createNormalizeImagePathsPlugin();
        const doc = makeDoc({ img: "path/to/image.bmp" });
        await expect(plugin.transform(doc, emptyContext)).rejects.toThrow(PackToolsError);
    });

    it("normalizes recursive system.img fields", async () => {
        const plugin = createNormalizeImagePathsPlugin({ gameSystemPath: "systems/dnd5e" });
        const doc = makeDoc({
            system: {
                iconImg: "https://assets.forge-vtt.com/bazaar/assets/path/icon.png",
            },
        });
        await plugin.transform(doc, emptyContext);
        expect((doc.system as any).iconImg).toBe("systems/dnd5e/path/icon.png");
    });

    it("accepts valid extensions", async () => {
        const plugin = createNormalizeImagePathsPlugin();
        const valid = [".webp", ".svg", ".png", ".jpg", ".jpeg", ".gif"];
        for (const ext of valid) {
            const doc = makeDoc({ img: `image${ext}` });
            await expect(plugin.transform(doc, emptyContext)).resolves.toBeUndefined();
        }
    });
});

describe("createPruneDefaultsPlugin", () => {
    it("removes default top-level fields", async () => {
        const plugin = createPruneDefaultsPlugin();
        const doc = makeDoc({ sort: 1, effects: [], _stats: {}, folder: null });
        await plugin.transform(doc, emptyContext);
        expect(doc).not.toHaveProperty("sort");
        expect(doc).not.toHaveProperty("effects");
        expect(doc).not.toHaveProperty("_stats");
        expect(doc).not.toHaveProperty("folder");
    });

    it("strips null folder", async () => {
        const plugin = createPruneDefaultsPlugin();
        const doc = makeDoc({ folder: null });
        await plugin.transform(doc, emptyContext);
        expect(doc).not.toHaveProperty("folder");
    });

    it("prunes ownership when normalizeOwnership is true", async () => {
        const plugin = createPruneDefaultsPlugin({ normalizeOwnership: true });
        const doc = makeDoc({ ownership: { default: 0 } });
        await plugin.transform(doc, emptyContext);
        expect(doc).not.toHaveProperty("ownership");
    });

    it("keeps non-default ownership", async () => {
        const plugin = createPruneDefaultsPlugin({ normalizeOwnership: true });
        const doc = makeDoc({ ownership: { default: 0, someUser: 3 } });
        await plugin.transform(doc, emptyContext);
        expect(doc).toHaveProperty("ownership");
    });

    it("prunes embedded fields", async () => {
        const plugin = createPruneDefaultsPlugin({ embeddedFields: ["items"] });
        const doc = makeDoc({
            items: [
                { _id: "i1", name: "Item", type: "weapon", sort: 5, _stats: {} } as unknown as PackEntry,
            ],
        });
        await plugin.transform(doc, emptyContext);
        const item = doc.items![0] as Record<string, unknown>;
        expect(item).not.toHaveProperty("sort");
        expect(item).not.toHaveProperty("_stats");
    });
});

describe("createValidateLinksPlugin", () => {
    it("detects @UUID links", async () => {
        const plugin = createValidateLinksPlugin();
        const doc = makeDoc({
            system: { description: { value: '@UUID[Compendium.dnd5e.items.abcdefghijklmnop]' } },
        });
        await expect(plugin.transform(doc, emptyContext)).resolves.toBeUndefined();
    });

    it("detects @Compendium links", async () => {
        const plugin = createValidateLinksPlugin();
        const doc = makeDoc({
            system: { description: { value: '@Compendium[dnd5e.items]' } },
        });
        await expect(plugin.transform(doc, emptyContext)).resolves.toBeUndefined();
    });

    it("detects roll macros", async () => {
        const plugin = createValidateLinksPlugin();
        const doc = makeDoc({
            system: { description: { value: "[[/r 1d20]]" } },
        });
        await expect(plugin.transform(doc, emptyContext)).resolves.toBeUndefined();
    });

    it("throws on disallowed system when allowedSystems is set", async () => {
        const plugin = createValidateLinksPlugin({ allowedSystems: ["dnd5e"] });
        const doc = makeDoc({
            system: { description: { value: '@UUID[Compendium.pf2e.items.abcdefghijklmnop]' } },
        });
        await expect(plugin.transform(doc, emptyContext)).rejects.toThrow(/disallowed system/);
    });

    it("warns instead of throwing in warnOnly mode", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const plugin = createValidateLinksPlugin({ allowedSystems: ["dnd5e"], warnOnly: true });
        const doc = makeDoc({
            system: { description: { value: '@UUID[Compendium.pf2e.items.abcdefghijklmnop]' } },
        });
        await expect(plugin.transform(doc, emptyContext)).resolves.toBeUndefined();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});

describe("LINK_PATTERNS", () => {
    it("exports an array of global regexes", () => {
        expect(Array.isArray(LINK_PATTERNS)).toBe(true);
        expect(LINK_PATTERNS.length).toBeGreaterThan(0);
        for (const pattern of LINK_PATTERNS) {
            expect(pattern).toBeInstanceOf(RegExp);
        }
    });

    it("matches @UUID patterns", () => {
        const pattern = LINK_PATTERNS.find((p) => p.source.includes("@UUID"));
        expect(pattern).toBeDefined();
        if (pattern) {
            pattern.lastIndex = 0;
            expect(pattern.test("@UUID[Compendium.pack.type.ID]")).toBe(true);
        }
    });

    it("matches @Compendium patterns", () => {
        const pattern = LINK_PATTERNS.find((p) => p.source.includes("@Compendium"));
        expect(pattern).toBeDefined();
        if (pattern) {
            pattern.lastIndex = 0;
            expect(pattern.test("@Compendium[dnd5e.spells]")).toBe(true);
        }
    });
});
