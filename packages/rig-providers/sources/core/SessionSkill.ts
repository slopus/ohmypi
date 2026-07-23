export type SessionSkillSource =
    | "file"
    | "environment_resource"
    | "orchestrator_resource"
    | "custom_resource";

export interface SessionSkill {
    readonly name: string;
    readonly description: string;
    readonly source: SessionSkillSource;
    readonly location: string;
}

export interface SessionSkillsOptions {
    readonly skills?: readonly SessionSkill[];
}
