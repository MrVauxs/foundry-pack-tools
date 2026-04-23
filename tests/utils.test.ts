import { describe, it, expect } from "vitest";
import { sluggify, prettyPrintPackJSON } from "../src/utils/index.js";
import { PackToolsError } from "../src/error.js";

describe("sluggify", () => {
    it("converts normal strings to slugs", () => {
        expect(sluggify("Hello World")).toBe("hello-world");
    });

    it("handles unicode and special characters", () => {
        expect(sluggify("Café & Restaurant")).toBe("caf-restaurant");
    });

    it("strips leading and trailing dashes", () => {
        expect(sluggify("---hello---")).toBe("hello");
    });

    it("collapses multiple dashes sequences", () => {
        expect(sluggify("foo---bar___baz")).toBe("foo-bar-baz");
    });

    it("handles already-slugged input", () => {
        expect(sluggify("already-a-slug")).toBe("already-a-slug");
    });

    it("handles empty string", () => {
        expect(sluggify("")).toBe("");
    });

    it("handles whitespace-only string", () => {
        expect(sluggify("   ")).toBe("");
    });
});

describe("prettyPrintPackJSON", () => {
    it("serializes simple objects with sorted keys", () => {
        const obj = { z: 1, a: 2, m: 3 };
        const result = prettyPrintPackJSON(obj);
        const parsed = JSON.parse(result);
        const keys = Object.keys(parsed);
        expect(keys).toEqual(["a", "m", "z"]);
    });

    it("pushes DocID keys to the end", () => {
        const obj = { name: "test", "abcdefghijklmnopqrst": "doc1", _id: "123", "zyxwvutsrqponmlkjihg": "doc2" };
        const result = prettyPrintPackJSON(obj);
        const parsed = JSON.parse(result);
        const keys = Object.keys(parsed);
        const nonDocIdKeys = keys.filter((k) => !/^[0-9a-zA-Z]{20,}$/.test(k));
        const docIdKeys = keys.filter((k) => /^[0-9a-zA-Z]{20,}$/.test(k));
        expect(keys).toEqual([...nonDocIdKeys, ...docIdKeys]);
    });

    it("handles nested objects", () => {
        const obj = {
            outer: { z: 1, a: 2 },
            b: 3,
        };
        const result = prettyPrintPackJSON(obj);
        const parsed = JSON.parse(result);
        const outerKeys = Object.keys(parsed.outer);
        expect(outerKeys).toEqual(["a", "z"]);
        const topKeys = Object.keys(parsed);
        expect(topKeys).toEqual(["b", "outer"]);
    });

    it("handles arrays", () => {
        const obj = { items: [{ z: 1 }, { a: 2 }] };
        const result = prettyPrintPackJSON(obj);
        const parsed = JSON.parse(result);
        expect(parsed.items[0]).toEqual({ z: 1 });
        expect(parsed.items[1]).toEqual({ a: 2 });
    });

    it("handles primitives", () => {
        expect(prettyPrintPackJSON(null)).toBe("null\n");
        expect(prettyPrintPackJSON(42)).toBe("42\n");
        expect(prettyPrintPackJSON("hello")).toBe("\"hello\"\n");
    });

    it("produces deterministic output with 4-space indent", () => {
        const obj = { b: 1, a: { d: 2, c: 3 } };
        const result = prettyPrintPackJSON(obj);
        expect(result).toContain('    "a"');
        expect(result).toContain('        "c"');
    });
});

describe("PackToolsError", () => {
    it("creates an error with message", () => {
        const err = new PackToolsError("something went wrong");
        expect(err.message).toBe("something went wrong");
        expect(err.name).toBe("PackToolsError");
        expect(err.cause).toBeUndefined();
    });

    it("creates an error with cause", () => {
        const cause = new Error("original error");
        const err = new PackToolsError("wrapped error", cause);
        expect(err.message).toBe("wrapped error");
        expect(err.cause).toBe(cause);
    });

    it("chains multiple errors", () => {
        const root = new Error("root cause");
        const middle = new PackToolsError("middle error", root);
        const top = new PackToolsError("top error", middle);
        expect(top.cause).toBe(middle);
        expect(top.cause?.cause).toBe(root);
    });

    it("is an instance of Error", () => {
        const err = new PackToolsError("test");
        expect(err).toBeInstanceOf(Error);
    });
});
