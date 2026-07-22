import type { AnyDefinedTool } from "../../agent/types.js";
import type { ClaudeToolDefinition } from "./types.js";

const DIRECTLY_ALIGNED_TOOLS = new Set([
    "Edit",
    "Write",
    "TaskCreate",
    "TaskGet",
    "TaskUpdate",
    "WebSearch",
]);

export function computeClaudeProfileTools(
    goldenTools: readonly ClaudeToolDefinition[],
    rigTools: readonly AnyDefinedTool[],
): readonly ClaudeToolDefinition[] {
    const goldenByName = new Map(goldenTools.map((tool) => [tool.name, tool]));
    return rigTools.map((rigTool) => {
        const golden = goldenByName.get(rigTool.name);
        if (golden === undefined) return fromRigTool(rigTool);
        if (DIRECTLY_ALIGNED_TOOLS.has(rigTool.name)) {
            return rigTool.name === "TaskCreate"
                ? {
                      ...cloneDefinition(golden),
                      description: replaceExactlyOnce(
                          golden.description,
                          "- Plan mode - When using plan mode, create a task list to track the work\n",
                          "",
                      ),
                  }
                : cloneDefinition(golden);
        }

        switch (rigTool.name) {
            case "Bash":
                return extendBash(golden, rigTool);
            case "Read":
                return removeUnsupportedReadFeatures(golden, rigTool);
            case "TaskOutput":
                return { ...cloneDefinition(golden), description: rigTool.description };
            case "TaskStop":
                return fromRigTool(rigTool);
            case "TaskList":
                return {
                    ...cloneDefinition(golden),
                    description: replaceExactlyOnce(
                        golden.description,
                        "including description and comments.",
                        "including its description.",
                    ),
                };
            case "WebFetch": {
                const definition = cloneDefinition(golden);
                const schema = definition.input_schema as typeof definition.input_schema & {
                    properties?: { url?: { format?: string } };
                };
                if (schema.properties?.url?.format !== "uri") {
                    throw new Error("Claude WebFetch URL format changed.");
                }
                delete schema.properties.url.format;
                return definition;
            }
            case "SendMessage":
                return extendWithRigProperties(
                    golden,
                    rigTool,
                    ["summary", "effort"],
                    rigTool.description,
                );
            case "Agent":
            case "Workflow":
                return fromRigTool(rigTool);
            default:
                throw new Error(`Unclassified Claude tool definition '${rigTool.name}'.`);
        }
    });
}

function extendBash(golden: ClaudeToolDefinition, rigTool: AnyDefinedTool): ClaudeToolDefinition {
    const persistentDirectoryLine =
        "- Working directory persists between calls, but prefer absolute paths — `cd` in a compound command can trigger a permission prompt. Shell state (env vars, functions) does not persist; the shell is initialized from the user's profile.\n";
    let description: string;
    if (golden.description.includes(persistentDirectoryLine)) {
        description = replaceExactlyOnce(
            golden.description,
            persistentDirectoryLine,
            "- Commands start in the session working directory. Shell state (such as `cd`, environment variables, and functions) does not persist between calls.\n",
        );
        const brandedSuffix =
            /\n- End git commit messages with:\nCo-Authored-By: Claude .+ <noreply@anthropic\.com>\n- End PR bodies with:\n🤖 Generated with \[Claude Code\]\(https:\/\/claude\.com\/claude-code\)$/u;
        if (!brandedSuffix.test(description)) {
            throw new Error("Claude Bash attribution text changed.");
        }
        description = description.replace(brandedSuffix, "").trimEnd();
    } else {
        // Sonnet's much larger Bash description assumes Claude Code-specific task and PR flows.
        description = rigTool.description;
    }
    description +=
        "\n\nRig extension: `secrets` injects selected session secret bundles. `dangerouslyDisableSandbox` requests one reviewed full-access execution in Auto mode; it never bypasses Read only or Workspace write mode.";
    return extendWithRigProperties(
        golden,
        rigTool,
        ["secrets", "dangerouslyDisableSandbox"],
        description,
    );
}

function removeUnsupportedReadFeatures(
    golden: ClaudeToolDefinition,
    rigTool: AnyDefinedTool,
): ClaudeToolDefinition {
    const definition = cloneDefinition(golden);
    const compactFeatureLine =
        '- Reads images (PNG, JPG, …) and presents them visually. Reads PDFs via the `pages` parameter (e.g. "1-5", max 20 pages/request; required for PDFs over 10 pages). Reads Jupyter notebooks (.ipynb) as cells with outputs.';
    definition.description = definition.description.includes(compactFeatureLine)
        ? replaceExactlyOnce(
              definition.description,
              compactFeatureLine,
              "- Reads images (PNG, JPG, and other common formats) and presents them visually. PDF page rendering and Jupyter notebook cell parsing are not supported.",
          ).replace(
              "- Reading a directory, a missing file, or an empty file returns an error or system reminder rather than content.",
              "- Reading a directory or missing file returns an error. Empty files are returned as `(empty file)`.",
          )
        : rigTool.description;
    const schema = definition.input_schema as typeof definition.input_schema & {
        properties?: Record<string, unknown>;
    };
    if (schema.properties?.pages === undefined) {
        throw new Error("Claude Read.pages disappeared from the official schema.");
    }
    delete schema.properties.pages;
    return definition;
}

function extendWithRigProperties(
    golden: ClaudeToolDefinition,
    rigTool: AnyDefinedTool,
    propertyNames: readonly string[],
    description: string,
): ClaudeToolDefinition {
    const definition = cloneDefinition(golden);
    const goldenSchema = definition.input_schema as typeof definition.input_schema & {
        properties?: Record<string, unknown>;
    };
    const rigSchema = rigTool.arguments as typeof rigTool.arguments & {
        properties?: Record<string, unknown>;
    };
    for (const propertyName of propertyNames) {
        const property = rigSchema.properties?.[propertyName];
        if (property === undefined) {
            throw new Error(`Rig tool '${rigTool.name}' has no '${propertyName}' property.`);
        }
        if (goldenSchema.properties === undefined) goldenSchema.properties = {};
        goldenSchema.properties[propertyName] = JSON.parse(JSON.stringify(property));
    }
    definition.description = description;
    return definition;
}

function fromRigTool(tool: AnyDefinedTool): ClaudeToolDefinition {
    return {
        name: tool.name,
        description: tool.description,
        input_schema: JSON.parse(JSON.stringify(tool.arguments)),
    };
}

function cloneDefinition(definition: ClaudeToolDefinition): ClaudeToolDefinition {
    return JSON.parse(JSON.stringify(definition)) as ClaudeToolDefinition;
}

function replaceExactlyOnce(value: string, find: string, replace: string): string {
    const first = value.indexOf(find);
    if (first === -1 || value.indexOf(find, first + find.length) !== -1) {
        throw new Error(`Claude tool transformation expected exactly one match: ${find}`);
    }
    return `${value.slice(0, first)}${replace}${value.slice(first + find.length)}`;
}
