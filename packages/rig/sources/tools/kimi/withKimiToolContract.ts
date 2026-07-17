import type { TSchema } from "@sinclair/typebox";

import type { AnyDefinedTool } from "../../agent/types.js";

interface ObjectSchemaWithProperties extends TSchema {
    properties?: Record<string, TSchema>;
}

export function withKimiToolContract<T extends AnyDefinedTool>(
    tool: T,
    contract: {
        argumentDescriptions?: Readonly<Record<string, string>>;
        description: string;
        label?: string;
        name?: string;
    },
): T {
    const argumentSchema = tool.arguments as ObjectSchemaWithProperties;
    const argumentsWithDescriptions =
        contract.argumentDescriptions === undefined || argumentSchema.properties === undefined
            ? tool.arguments
            : ({
                  ...argumentSchema,
                  properties: Object.fromEntries(
                      Object.entries(argumentSchema.properties).map(([name, schema]) => [
                          name,
                          contract.argumentDescriptions?.[name] === undefined
                              ? schema
                              : {
                                    ...schema,
                                    description: contract.argumentDescriptions[name],
                                },
                      ]),
                  ),
              } as typeof tool.arguments);
    return {
        ...tool,
        arguments: argumentsWithDescriptions,
        description: contract.description,
        ...(contract.label === undefined ? {} : { label: contract.label }),
        ...(contract.name === undefined ? {} : { name: contract.name }),
    } as T;
}
