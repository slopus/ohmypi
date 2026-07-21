import { createHash } from "node:crypto";
import { join } from "node:path";

export interface HappyPaths {
    credentialsPath: string;
    directory: string;
    machinePath: string;
    settingsPath: string;
}

export function getHappyPaths(rigHome: string, machineScope?: string): HappyPaths {
    const directory = join(rigHome, "happy");
    const machinePath =
        machineScope === undefined
            ? join(directory, "machine.json")
            : join(
                  directory,
                  "machines",
                  `${createHash("sha256").update(machineScope).digest("hex")}.json`,
              );
    return {
        credentialsPath: join(directory, "access.key"),
        directory,
        machinePath,
        settingsPath: join(directory, "settings.json"),
    };
}
