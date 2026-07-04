export function capOutput(value: string, maxBytes: number | undefined): string {
  if (maxBytes === undefined) {
    return value;
  }

  const buffer = Buffer.from(value);
  return buffer.length <= maxBytes
    ? value
    : buffer.subarray(0, maxBytes).toString("utf8");
}
