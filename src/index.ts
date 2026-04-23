export { PackToolsError } from "./error.js";

export type {
    PackEntry,
    ActorPackEntry,
    SystemPackEntry,
    TransformPlugin,
    TransformContext,
    PackMetadata,
    SystemManifest,
    DBFolder,
} from "./types.js";

export {
    getPackJSONPaths,
    getFolderPath,
    readPackJSON,
    readFoldersFromPack,
    prettyPrintPackJSON,
    assertDocIdsStable,
    sluggify,
} from "./utils/index.js";

export {
    createTransformEntry,
    createClearFlagsPlugin,
    createCleanDescriptionHTMLPlugin,
    cleanHTML,
    createNormalizeImagePathsPlugin,
    createPruneDefaultsPlugin,
    createValidateLinksPlugin,
    LINK_PATTERNS,
} from "./pipeline/index.js";

export type {
    ClearFlagsOptions,
    CleanHTMLOptions,
    NormalizeImagesOptions,
    PruneDefaultsOptions,
    ValidateLinksOptions,
} from "./pipeline/index.js";

export {
    buildIdNameMap,
    convertUUIDsToNames,
    createConvertUUIDsToNamesPlugin,
    convertUUIDsToIds,
    createConvertUUIDsToIdsPlugin,
} from "./uuid/index.js";

export type {
    ConvertUUIDsToNamesOptions,
    ConvertUUIDsToIdsOptions,
} from "./uuid/index.js";
