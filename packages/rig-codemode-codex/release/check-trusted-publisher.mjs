import { readFileSync } from "node:fs";

const serialized = readFileSync(0, "utf8");
if (serialized.trim() === "") {
    process.exit(2);
}

let value;
try {
    value = JSON.parse(serialized);
} catch {
    process.exit(3);
}

const records = Array.isArray(value) ? value : [value];
if (records.length === 0) {
    process.exit(2);
}

const matches = records.filter(
    (record) =>
        record !== null &&
        typeof record === "object" &&
        record.type === "github" &&
        record.repository === "slopus/rig" &&
        record.file === "publish-rig-codemode-codex.yml" &&
        record.environment === "npm" &&
        Array.isArray(record.permissions) &&
        record.permissions.length === 1 &&
        record.permissions[0] === "createPackage",
);
process.exit(records.length === 1 && matches.length === 1 ? 0 : 3);
