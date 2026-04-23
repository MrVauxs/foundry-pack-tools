import { describe, it, expect, vi, beforeEach } from "vitest";
import { PackToolsError } from "../src/error.js";
import type { DBFolder, TransformContext } from "../src/types.js";

const mockFs = vi.hoisted(() => ({
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
    statSync: vi.fn(),
}));

vi.mock("node:fs", () => mockFs);

import { getPackJSONPaths, getFolderPath, readPackJSON, readFoldersFromPack } from "../src/utils/fs.js";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("getPackJSONPaths", () => {
    it("enumerates JSON files recursively", () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync
            .mockReturnValueOnce([
                { name: "a.json", isDirectory: () => false, isFile: () => true },
                { name: "sub", isDirectory: () => true, isFile: () => false },
            ])
            .mockReturnValueOnce([
                { name: "b.json", isDirectory: () => false, isFile: () => true },
            ]);

        const result = getPackJSONPaths("/packs");
        expect(result.length).toBe(2);
        expect(result[0]).toContain("a.json");
        expect(result[1]).toContain("b.json");
    });

    it("throws PackToolsError when directory does not exist", () => {
        mockFs.existsSync.mockReturnValue(false);
        expect(() => getPackJSONPaths("/nonexistent")).toThrow(PackToolsError);
    });

    it("uses baseDir when provided", () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValueOnce([]);

        getPackJSONPaths("/packs", "subdir");
        expect(mockFs.existsSync).toHaveBeenCalledWith(expect.stringContaining("subdir"));
    });

    it("skips non-JSON files", () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValueOnce([
            { name: "data.json", isDirectory: () => false, isFile: () => true },
            { name: "readme.txt", isDirectory: () => false, isFile: () => true },
        ]);

        const result = getPackJSONPaths("/packs");
        expect(result).toHaveLength(1);
        expect(result[0]).toContain("data.json");
    });
});

describe("getFolderPath", () => {
    const folders: DBFolder[] = [
        { _id: "f1", name: "Root", type: "Folder", sort: 0, color: null, parent: null, flags: {}, _stats: {} },
        { _id: "f2", name: "Child", type: "Folder", sort: 0, color: null, parent: "f1", flags: {}, _stats: {} },
        { _id: "f3", name: "Grandchild", type: "Folder", sort: 0, color: null, parent: "f2", flags: {}, _stats: {} },
    ];

    it("returns empty string for null folder", () => {
        const context: TransformContext = {};
        expect(getFolderPath(context, null, folders)).toBe("");
    });

    it("returns empty string for undefined folder", () => {
        const context: TransformContext = {};
        expect(getFolderPath(context, undefined, folders)).toBe("");
    });

    it("returns folder name for flat folder", () => {
        const context: TransformContext = {};
        expect(getFolderPath(context, folders[0], folders)).toBe("root");
    });

    it("returns nested path for child folder", () => {
        const context: TransformContext = {};
        expect(getFolderPath(context, folders[2], folders)).toBe("root/child/grandchild");
    });
});

describe("readPackJSON", () => {
    it("parses valid JSON", () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('{"_id":"abc","name":"Test"}');

        const result = readPackJSON("/packs/doc.json");
        expect(result).toEqual({ _id: "abc", name: "Test" });
    });

    it("throws PackToolsError when file does not exist", () => {
        mockFs.existsSync.mockReturnValue(false);
        expect(() => readPackJSON("/missing.json")).toThrow(PackToolsError);
    });

    it("throws PackToolsError with cause for invalid JSON", () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue("not json");
        expect(() => readPackJSON("/bad.json")).toThrow(PackToolsError);
    });
});

describe("readFoldersFromPack", () => {
    it("returns folders array when folders.db.json exists", () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('[{"_id":"f1","name":"Test"}]');

        const result = readFoldersFromPack("/packs");
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("Test");
    });

    it("returns empty array when folders.db.json is missing", () => {
        mockFs.existsSync.mockReturnValue(false);
        const result = readFoldersFromPack("/packs");
        expect(result).toEqual([]);
    });

    it("returns empty array when parsed JSON is not an array", () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('{"not":"array"}');
        const result = readFoldersFromPack("/packs");
        expect(result).toEqual([]);
    });
});
