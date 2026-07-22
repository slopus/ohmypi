import { expect, test } from "vitest";

import { MAX_JSON_DEPTH, assertJsonValue } from "./assertJsonValue.js";

test("rejects nested non-finite JSON numbers", () => {
    expect(() => assertJsonValue({ outer: [{ value: Number.NaN }] })).toThrow("non-finite number");
    expect(() => assertJsonValue({ value: Number.POSITIVE_INFINITY })).toThrow("non-finite number");
});

test("preserves valid JSON values", () => {
    expect(() =>
        assertJsonValue({ array: [null, true, 42, "text"], object: { value: -1 } }),
    ).not.toThrow();
});

test("accepts the depth boundary and rejects the next level", () => {
    let accepted: unknown = null;
    for (let depth = 0; depth < MAX_JSON_DEPTH; depth += 1) {
        accepted = [accepted];
    }
    expect(() => assertJsonValue(accepted)).not.toThrow();

    const rejected = [accepted];
    expect(() => assertJsonValue(rejected)).toThrow("maximum JSON depth");
});
