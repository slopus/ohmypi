#!/usr/bin/env node

import { main } from "./app/main.js";

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
