export class PackToolsError extends Error {
    constructor(
        message: string,
        public override readonly cause?: Error,
    ) {
        super(message);
        this.name = "PackToolsError";
    }
}
