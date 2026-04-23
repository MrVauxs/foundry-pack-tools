export interface PackEntry {
    _id: string;
    name: string;
    type: string;
    img?: string;
    system?: Record<string, unknown>;
    flags?: Record<string, Record<string, unknown>>;
    folder?: string | null;
    sort?: number;
    _stats?: Record<string, unknown>;
    effects?: string[];
    ownership?: Record<string, number>;
    [key: string]: unknown;
}

export interface ActorPackEntry extends PackEntry {
    type: "npc" | "character" | "vehicle" | "group" | "hazard";
    items?: PackEntry[];
}

export interface SystemPackEntry extends PackEntry {
    system: {
        description?: {
            value?: string;
            chat?: string;
            unidentified?: string;
        };
        source?: {
            book?: string;
            page?: string;
            license?: string;
        };
        [key: string]: unknown;
    };
}

export interface TransformContext {
    adventure?: { doc: object; path: string };
    folder?: string;
    documentType?: string;
    packPath?: string;
}

export interface TransformPlugin {
    name: string;
    transform: (doc: PackEntry, context: TransformContext) => Promise<false | void>;
}

export interface PackMetadata {
    id: string;
    label: string;
    path: string;
    system?: string;
    type?: string;
    banner?: string;
    foreground?: string;
}

export interface SystemManifest {
    id: string;
    name: string;
    version: string;
    title: string;
    description: string;
    authors: Array<{ name: string }>;
    systems: string[];
    compatibility: {
        minimum: string;
        verified: string;
    };
    packs: PackMetadata[];
    esmodules: string[];
    styles: string[];
    [key: string]: unknown;
}

export interface DBFolder {
    _id: string;
    name: string;
    type: string;
    sort: number;
    color: string | null;
    parent: string | null;
    flags: Record<string, Record<string, unknown>>;
    _stats: Record<string, unknown>;
}
