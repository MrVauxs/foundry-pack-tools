declare module "@foundryvtt/foundryvtt-cli" {
  /** A Foundry VTT primary document type. */
  export type DocumentType =
    | "ActiveEffect" | "Actor" | "Adventure" | "Cards"
    | "ChatMessage" | "Combat" | "FogExploration" | "Folder"
    | "Item" | "JournalEntry" | "Macro" | "Playlist"
    | "RollTable" | "Scene" | "Setting" | "User";

  /** The internal collection name corresponding to a DocumentType. */
  export type DocumentCollection =
    | "actors" | "adventures" | "cards" | "messages" | "combats"
    | "effects" | "fog" | "folders" | "items" | "journal"
    | "macros" | "playlists" | "tables" | "scenes" | "settings" | "users";

  /** Shared options for both compile and extract operations. */
  export interface PackageOptions {
    /** Operate on a NeDB (.db) database. Defaults to LevelDB if false. @default false */
    nedb?: boolean;
    /** Source files are YAML. Defaults to JSON if false. @default false */
    yaml?: boolean;
    /** Log operation progress to the console. @default false */
    log?: boolean;
    /** Called on every entry. Return `false` to discard the entry. */
    transformEntry?: EntryTransformer;
  }

  /** Options for {@link compilePack}. */
  export interface CompileOptions extends PackageOptions {
    /** Recurse into subdirectories under `src` to find source files. @default false */
    recursive?: boolean;
  }

  /** Options for {@link extractPack}. */
  export interface ExtractOptions extends PackageOptions {
    /** Options passed to `yaml.dump` when serializing documents. */
    yamlOptions?: object;
    /** Options passed to `JSON.stringify` when serializing documents. */
    jsonOptions?: JSONOptions;
    /**
     * Required for NeDB operations. Must match the pack's `type` field
     * in your `module.json` or `system.json`.
     */
    documentType?: DocumentType;
    /** Delete the destination directory before extracting. */
    clean?: boolean;
    /**
     * Mirror the pack's Folder structure as directories.
     * Folder documents are written as `_Folder.{yml|json}` inside their directory.
     */
    folders?: boolean;
    /**
     * Write documents embedded in Adventures to their own files.
     * If `folders` is also set, the Adventure acts as a folder root and entries
     * are grouped into subdirectories by document type, with the adventure itself
     * written as `_Adventure.{yml|json}`.
     */
    expandAdventures?: boolean;
    /**
     * Diff each extracted entry against the existing file and skip writing
     * if only volatile fields changed. Volatile fields are:
     * `_stats.createdTime`, `_stats.modifiedTime`, `_stats.lastModifiedBy`,
     * `_stats.systemVersion`, `_stats.coreVersion`.
     */
    omitVolatile?: boolean;
    /** Can be used instead of `documentType` for NeDB operations if the collection name is known. */
    collection?: DocumentCollection;
    /**
     * Return a filename (including extension) for the extracted document.
     * Resolved against the root `dest` path. Falls back to an auto-generated name if nothing is returned.
     */
    transformName?: NameTransformer;
    /**
     * Return a directory name for an extracted Folder document.
     * Only used when `folders` is enabled.
     */
    transformFolderName?: NameTransformer;
    /**
     * Called on the serialized string before it is written to disk.
     * The returned string is what gets written.
     */
    transformSerialized?: SerializationTransformer;
  }

  /** Options passed to `JSON.stringify` during document serialization. */
  export interface JSONOptions {
    /**
     * A replacer function or allowlist of property names to include
     * in the resulting JSON string.
     */
    replacer?: ((key: string, value: any) => any) | Array<string | number>;
    /** Number of spaces or a string to use as indentation. */
    space?: string | number;
  }

  /**
   * Called on every document entry during compile or extract.
   * Return `false` to discard the entry entirely.
   */
  export type EntryTransformer = (
    entry: Record<string, any>,
    context?: TransformerContext
  ) => Promise<false | void>;

  /**
   * Called on every document entry during extraction to determine its output filename.
   * Must include the file extension. If nothing is returned, a name is auto-generated.
   */
  export type NameTransformer = (
    entry: object,
    context?: TransformerContext
  ) => Promise<string | void>;

  /**
   * Called on the serialized document string before writing.
   * Must return the string to be written to disk.
   */
  export type SerializationTransformer = (
    content: string,
    context: { filename: string; yaml: boolean }
  ) => Promise<string>;

  /** Contextual metadata passed to transformer callbacks. */
  export interface TransformerContext {
    /** Set when the document belongs to an Adventure. */
    adventure?: {
      /** The full Adventure document. */
      doc: object;
      /** The path where the Adventure file will be written. */
      path: string;
    };
    /** The folder path when `folders` is enabled and the document is in a folder. */
    folder?: string;
    /** The Foundry document type of the entry being transformed. */
    documentType?: DocumentType;
  }

  /** Maps each primary DocumentType to its internal collection name. */
  export const TYPE_COLLECTION_MAP: Record<DocumentType, DocumentCollection>;

  /** Maps each internal collection name back to its primary DocumentType. */
  export const COLLECTION_TYPE_MAP: Record<DocumentCollection, DocumentType>;

  /**
   * Compile source files into a compendium pack.
   * @param src  Directory containing the source files.
   * @param dest Target compendium pack — a directory for LevelDB, or a `.db` file for NeDB.
   */
  export function compilePack(
    src: string,
    dest: string,
    options?: CompileOptions
  ): Promise<void>;

  /**
   * Extract the contents of a compendium pack into individual source files.
   * @param src  Source compendium pack — a directory for LevelDB, or a `.db` file for NeDB.
   * @param dest Directory to write the extracted files into.
   */
  export function extractPack(
    src: string,
    dest: string,
    options?: ExtractOptions
  ): Promise<void>;
}