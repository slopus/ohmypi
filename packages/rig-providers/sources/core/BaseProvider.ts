export abstract class BaseProvider {
    static readonly name: string;

    get name(): string {
        return (this.constructor as typeof BaseProvider).name;
    }
}
