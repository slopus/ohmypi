export class ImageProcessingError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "ImageProcessingError";
    }
}
