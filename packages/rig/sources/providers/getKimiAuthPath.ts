import { join } from "node:path";

import { getKimiHome } from "./getKimiHome.js";

export function getKimiAuthPath(options: { authFile?: string; env?: NodeJS.ProcessEnv }): string {
    const authFile = options.authFile?.trim();
    if (authFile) return authFile;
    return join(getKimiHome(options.env), "credentials", "kimi-code.json");
}
