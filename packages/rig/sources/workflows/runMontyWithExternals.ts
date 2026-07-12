import { Buffer } from "node:buffer";

import {
    Monty,
    MontyComplete,
    MontyNameLookup,
    MontySnapshot,
    type ResourceLimits,
} from "@pydantic/monty";

export async function runMontyWithExternals(options: {
    externalFunctions: Record<string, (...args: unknown[]) => unknown>;
    inputs: Record<string, unknown>;
    limits: ResourceLimits;
    monty: Monty;
    onPrint(text: string): void;
    onSnapshot(snapshot: Uint8Array): void;
    signal: AbortSignal;
    snapshot?: Uint8Array;
}): Promise<unknown> {
    const printCallback = (_stream: string, text: string) => options.onPrint(text);
    let progress =
        options.snapshot === undefined
            ? options.monty.start({
                  inputs: options.inputs,
                  limits: options.limits,
                  printCallback,
              })
            : MontySnapshot.load(Buffer.from(options.snapshot), { printCallback });
    while (!(progress instanceof MontyComplete)) {
        if (options.signal.aborted) throw new Error("The workflow was stopped.");
        if (progress instanceof MontyNameLookup) {
            const external = options.externalFunctions[progress.variableName];
            progress =
                external === undefined ? progress.resume() : progress.resume({ value: external });
            continue;
        }
        const external = options.externalFunctions[progress.functionName];
        if (external === undefined) {
            throw new Error(`Workflow function '${progress.functionName}' is unavailable.`);
        }
        options.onSnapshot(new Uint8Array(progress.dump()));
        const value = await external(...progress.args, progress.kwargs);
        progress = progress.resume({ returnValue: value });
    }
    return progress.output;
}
