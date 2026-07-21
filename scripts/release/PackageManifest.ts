export interface PackageManifest {
    dependencies?: Record<string, string>;
    name: string;
    version: string;
}
