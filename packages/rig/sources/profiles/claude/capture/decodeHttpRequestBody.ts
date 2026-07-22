import { brotliDecompressSync, gunzipSync, inflateSync, zstdDecompressSync } from "node:zlib";

export function decodeHttpRequestBody(body: Buffer, contentEncoding: string | undefined): Buffer {
    const encodings = (contentEncoding ?? "identity")
        .split(",")
        .map((encoding) => encoding.trim().toLowerCase())
        .filter((encoding) => encoding.length > 0);
    return encodings.toReversed().reduce((decoded, encoding) => {
        switch (encoding) {
            case "identity":
                return decoded;
            case "gzip":
                return gunzipSync(decoded);
            case "deflate":
                return inflateSync(decoded);
            case "br":
                return brotliDecompressSync(decoded);
            case "zstd":
                return zstdDecompressSync(decoded);
            default:
                throw new Error(`Unsupported Claude SDK request content encoding '${encoding}'.`);
        }
    }, body);
}
