# @slopus/rig-codemode-codex

Standalone Node.js access to the V8-backed Code Mode process from OpenAI Codex.
It runs JavaScript in a long-lived child process, supports persistent session
state, and delegates named tool calls back to your Node application. It is not
connected to Rig.

```ts
import { runCode } from "@slopus/rig-codemode-codex";

const result = await runCode(
    `
const answer = await tools.add({ left: 20, right: 22 });
text(answer.value);
`,
    {
        tools: [
            {
                name: "add",
                description: "Add two numbers.",
                inputSchema: {
                    type: "object",
                    properties: {
                        left: { type: "number" },
                        right: { type: "number" },
                    },
                    required: ["left", "right"],
                },
                execute(input) {
                    const values = input as { left: number; right: number };
                    return { value: values.left + values.right };
                },
            },
        ],
    },
);

console.log(result.text); // 42
```

For state that persists between executions, create a host and session:

```ts
import { createCodeMode } from "@slopus/rig-codemode-codex";

const codeMode = await createCodeMode();
const session = await codeMode.createSession();

await session.run(`store("answer", 42);`);
const result = await session.run(`text(load("answer"));`);

await session.close();
await codeMode.close();
```

`CodeModeSession` provides `execute`, `wait`, `terminate`, `run`, and `close`.
`execute` returns after the runtime produces an initial result or yield; `run`
automatically waits through yields until execution finishes. Output errors are
returned as `errorText`, rather than thrown as transport failures.

The runtime exposes Codex's `tools`, `ALL_TOOLS`, `text`, `image`, `audio`,
`generatedImage`, `store`, `load`, `notify`, `yield_control`, `exit`,
`setTimeout`, and `clearTimeout` globals. Source runs as an ES module with
top-level `await`; imports are disabled.

## Security boundary

The native Code Mode child is transparently wrapped in an operating-system
sandbox by default when the platform provides one:

- macOS uses `/usr/bin/sandbox-exec` with a closed Seatbelt profile. The process
  can read only its exact executable, required Apple runtime libraries and data,
  and inherited protocol file descriptors. Filesystem writes and all networking
  are denied.
- Linux uses Bubblewrap when `bwrap` is installed. It creates separate user,
  process, IPC, network, UTS, and cgroup namespaces; exposes only the host binary
  and read-only runtime libraries; and provides a private temporary filesystem.
- Windows currently has no package-managed system sandbox, so `auto` mode runs
  the child normally there.

Set `sandbox: "required"` to fail instead of falling back when the platform
sandbox is unavailable, or `sandbox: "disabled"` to explicitly bypass it. The
sandbox contains only the native Code Mode process. Tool callbacks run in the
Node process outside it and receive an `AbortSignal`.

This is an extra defense layer, not a complete security or resource boundary.
Untrusted JavaScript can still consume CPU or memory, and a tool callback can
provide capabilities outside the sandbox. Tool calls are never automatically
replayed after process or protocol failure.

## Native packages

The npm release uses six platform variants—macOS, statically linked Linux musl
builds, and Windows on arm64 and x64. The Linux builds install on both glibc and
musl systems. They are optional dependency aliases of
`@slopus/rig-codemode-codex`, so a normal install downloads only one native
binary. Shipping the binaries directly through npm is practical; putting every
binary in the root tarball is not, because it would make every user download all
platforms.

Build locally with:

```sh
pnpm --filter @slopus/rig-codemode-codex build:native
pnpm --filter @slopus/rig-codemode-codex build
pnpm --filter @slopus/rig-codemode-codex test
```

## Release

After the release commit is the current `slopus/rig` `main`, run:

```sh
pnpm --filter @slopus/rig-codemode-codex release
```

The script checks the clean upstream commit, runs the JavaScript and native test
suites, performs the one-time npm bootstrap and trusted-publisher setup when
needed, creates the GitHub `npm` environment, pushes the version tag, watches
the six-platform workflow, verifies all seven npm versions, and smoke-tests the
installed package. It never commits or pushes a branch. Pass `-- --help` for
the available release options.

See `UPSTREAM.md` for the exact Codex commit, versions, and vendoring details.
