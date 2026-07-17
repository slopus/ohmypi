import { homedir } from "node:os";
import { join } from "node:path";

export function getKimiHome(env?: NodeJS.ProcessEnv): string {
    return env?.KIMI_CODE_HOME?.trim() || join(homedir(), ".kimi-code");
}
