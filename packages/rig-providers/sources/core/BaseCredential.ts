export abstract class BaseCredential<const TName extends string, TCredential> {
    readonly name: TName;
    readonly credential: TCredential;

    protected constructor(name: TName, credential: TCredential) {
        this.name = name;
        this.credential = credential;
    }
}
