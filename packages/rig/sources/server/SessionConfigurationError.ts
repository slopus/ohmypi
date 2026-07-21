export class SessionConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SessionConfigurationError";
    }
}
