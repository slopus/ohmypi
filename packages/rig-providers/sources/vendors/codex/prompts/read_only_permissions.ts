export const read_only_permissions =
    "<permissions instructions>\n" +
    "Filesystem sandboxing defines which files can be read or written. `sandbox_mode` is " +
    "`read-only`: The sandbox only permits reading files. Network access is restricted.\n" +
    "Approval policy is currently never. Do not provide the `sandbox_permissions` for any " +
    "reason, commands will be rejected.\n" +
    "</permissions instructions>";
