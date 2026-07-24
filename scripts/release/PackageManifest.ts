export interface PackageManifest {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    name: string;
    version: string;
}
