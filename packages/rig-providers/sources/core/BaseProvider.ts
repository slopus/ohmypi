import type { ProviderModality } from "@/core/ProviderModality.js";
import type { BaseSession } from "@/core/BaseSession.js";
import type { SessionOptions } from "@/core/SessionOptions.js";

export abstract class BaseProvider {
    static readonly name: string;
    static readonly inputTypes: readonly ProviderModality[];
    static readonly outputTypes: readonly ProviderModality[];

    get name(): string {
        return (this.constructor as typeof BaseProvider).name;
    }

    get inputTypes(): readonly ProviderModality[] {
        return (this.constructor as typeof BaseProvider).inputTypes;
    }

    get outputTypes(): readonly ProviderModality[] {
        return (this.constructor as typeof BaseProvider).outputTypes;
    }

    abstract session(id: string, options: SessionOptions): Promise<BaseSession>;
}
