export interface EditFileOptions {
    path: string;
    oldString: string;
    newString: string;
    replaceAll?: boolean;
    cwd?: string;
    fuzzy?: boolean;
}

export interface EditFileResult {
    path: string;
    replacements: number;
    fuzzy: boolean;
    oldString: string;
    newString: string;
}

export interface TextEditPlan {
    path: string;
    nextContent: string;
    replacements: number;
    fuzzy: boolean;
}

export interface EditMatch {
    start: number;
    end: number;
    replacements: number;
    fuzzy: boolean;
}

export interface BatchEdit {
    oldText: string;
    newText: string;
}

export interface BatchEditFileOptions {
    path: string;
    edits: readonly BatchEdit[];
    cwd?: string;
    fuzzy?: boolean;
}

export interface BatchEditFileResult {
    path: string;
    replacements: number;
    fuzzy: boolean;
}
