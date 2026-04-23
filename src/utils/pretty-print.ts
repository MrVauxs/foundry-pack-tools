const DOC_ID_PATTERN = /^[0-9a-zA-Z]{20,}$/;

function isDocIdKey(key: string): boolean {
    return DOC_ID_PATTERN.test(key);
}

function sortKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(sortKeys);
    const entries = Object.entries(obj as Record<string, unknown>);
    const docIdKeys: [string, unknown][] = [];
    const otherKeys: [string, unknown][] = [];
    for (const [key, value] of entries) {
        const sortedValue = sortKeys(value);
        if (isDocIdKey(key)) {
            docIdKeys.push([key, sortedValue]);
        } else {
            otherKeys.push([key, sortedValue]);
        }
    }
    otherKeys.sort((a, b) => a[0].localeCompare(b[0]));
    docIdKeys.sort((a, b) => a[0].localeCompare(b[0]));
    const sorted: Record<string, unknown> = {};
    for (const [key, value] of otherKeys) {
        sorted[key] = value;
    }
    for (const [key, value] of docIdKeys) {
        sorted[key] = value;
    }
    return sorted;
}

export function prettyPrintPackJSON(obj: unknown): string {
    const sorted = sortKeys(obj);
    return JSON.stringify(sorted, null, 4) + "\n";
}
