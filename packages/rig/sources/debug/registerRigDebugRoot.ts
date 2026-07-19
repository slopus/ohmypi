export interface RigDebugRoot {
    kind: "daemon" | "tui";
    [name: string]: unknown;
}

export function registerRigDebugRoot(root: RigDebugRoot): void {
    Object.defineProperty(globalThis, "__rigDebug", {
        configurable: true,
        enumerable: false,
        value: root,
        writable: true,
    });
}
