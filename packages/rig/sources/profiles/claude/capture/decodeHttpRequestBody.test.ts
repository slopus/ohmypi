import { brotliCompressSync, deflateSync, gzipSync, zstdCompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { decodeHttpRequestBody } from "./decodeHttpRequestBody.js";

describe("decodeHttpRequestBody", () => {
    const raw = Buffer.from('{"prompt":"golden"}');

    it.each([
        [undefined, raw],
        ["identity", raw],
        ["gzip", gzipSync(raw)],
        ["deflate", deflateSync(raw)],
        ["br", brotliCompressSync(raw)],
        ["zstd", zstdCompressSync(raw)],
    ] as const)("decodes %s request bodies", (encoding, encoded) => {
        expect(decodeHttpRequestBody(encoded, encoding)).toEqual(raw);
    });

    it("fails closed for unknown request encodings", () => {
        expect(() => decodeHttpRequestBody(raw, "snappy")).toThrow(
            "Unsupported Claude SDK request content encoding 'snappy'",
        );
    });
});
