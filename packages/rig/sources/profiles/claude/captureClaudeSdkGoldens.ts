#!/usr/bin/env node
import { writeClaudeSdkGoldens } from "./capture/writeClaudeSdkGoldens.js";

const check = process.argv.includes("--check");
const written = await writeClaudeSdkGoldens({ check });
for (const path of written) process.stdout.write(`${check ? "Checked" : "Captured"} ${path}\n`);
