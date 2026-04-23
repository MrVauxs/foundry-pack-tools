declare module "@foundryvtt/foundryvtt-cli" {
    interface TransformerContext {
        adventure?: { doc: object; path: string };
        folder?: string;
        documentType?: string;
    }
    interface CompileOptions {
        nedb?: boolean;
        yaml?: boolean;
        log?: boolean;
        recursive?: boolean;
        transformEntry?: (entry: object, context: TransformerContext) => Promise<false | void>;
    }
    interface ExtractOptions {
        nedb?: boolean;
        yaml?: boolean;
        yamlOptions?: object;
        jsonOptions?: object;
        log?: boolean;
        folders?: boolean;
        documentType?: string;
        collection?: string;
        clean?: boolean;
        expandAdventures?: boolean;
        omitVolatile?: boolean;
        transformEntry?: (entry: object, context: TransformerContext) => Promise<false | void>;
        transformName?: (name: string) => string;
        transformFolderName?: (name: string) => string;
        transformSerialized?: (str: string) => string;
    }
    export function compilePack(src: string, dest: string, options?: CompileOptions): Promise<void>;
    export function extractPack(src: string, dest: string, options?: ExtractOptions): Promise<void>;
    export const TYPE_COLLECTION_MAP: Record<string, string>;
    export const COLLECTION_TYPE_MAP: Record<string, string>;
}
