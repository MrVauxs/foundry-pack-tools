declare module "@foundryvtt/foundryvtt-cli" {
  export type DocumentType =
    | "ActiveEffect" | "Actor" | "Adventure" | "Cards"
    | "ChatMessage" | "Combat" | "FogExploration" | "Folder"
    | "Item" | "JournalEntry" | "Macro" | "Playlist"
    | "RollTable" | "Scene" | "Setting" | "User";

  export type DocumentCollection =
    | "actors" | "adventures" | "cards" | "messages" | "combats"
    | "effects" | "fog" | "folders" | "items" | "journal"
    | "macros" | "playlists" | "tables" | "scenes" | "settings" | "users";

  export interface PackageOptions {
    nedb?: boolean;
    yaml?: boolean;
    log?: boolean;
    transformEntry?: EntryTransformer;
  }

  export interface CompileOptions extends PackageOptions {
    recursive?: boolean;
  }

  export interface ExtractOptions extends PackageOptions {
    yamlOptions?: object;
    jsonOptions?: JSONOptions;
    documentType?: DocumentType;
    clean?: boolean;
    folders?: boolean;
    expandAdventures?: boolean;
    omitVolatile?: boolean;
    collection?: DocumentCollection;
    transformName?: NameTransformer;
    transformFolderName?: NameTransformer;
    transformSerialized?: SerializationTransformer;
  }

  export interface JSONOptions {
    replacer?: ((key: string, value: any) => any) | Array<string | number>;
    space?: string | number;
  }

  export type EntryTransformer = (
    entry: Record<string, any>,
    context?: TransformerContext
  ) => Promise<false | void>;

  export type NameTransformer = (
    entry: object,
    context?: TransformerContext
  ) => Promise<string | void>;

  export type SerializationTransformer = (
    content: string,
    context: { filename: string; yaml: boolean }
  ) => Promise<string>;

  export interface TransformerContext {
    adventure?: { doc: object; path: string };
    folder?: string;
    documentType?: DocumentType;
  }

  export const TYPE_COLLECTION_MAP: Record<DocumentType, DocumentCollection>;
  export const COLLECTION_TYPE_MAP: Record<DocumentCollection, DocumentType>;

  export function compilePack(
    src: string,
    dest: string,
    options?: CompileOptions
  ): Promise<void>;

  export function extractPack(
    src: string,
    dest: string,
    options?: ExtractOptions
  ): Promise<void>;
}