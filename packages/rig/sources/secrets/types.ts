export interface SecretRegistration {
    description: string;
    environment: Readonly<Record<string, string>>;
    id: string;
}

export type RigSecret = SecretRegistration;

export type SecretAttachmentScope = "project" | "session";

export interface SecretReference {
    description: string;
    environmentVariables: readonly string[];
    id: string;
}
