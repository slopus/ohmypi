# Upstream source

The native runtime in `native/code-mode`, `native/code-mode-protocol`, and
`native/code-mode-host` is copied from OpenAI Codex:

- Repository: https://github.com/openai/codex
- Commit: `37eef7baccebaeb00e42a88b323054cdbfe418c5`
- Commit date: `2026-07-21T22:16:27Z`
- Retrieved: `2026-07-21`
- Source directory: `codex-rs`
- Upstream workspace version: `0.0.0`
- Rust toolchain at that commit: `1.95.0`
- V8 crate at that commit: `149.2.0`
- License: Apache-2.0

The copied code-mode crates are unmodified. `native/protocol` contains only the
upstream `codex-rs/protocol/src/tool_name.rs` type required by those crates,
plus a minimal crate manifest and re-export. The smaller protocol slice keeps
this standalone build independent from the rest of Codex.

The package's TypeScript process client, npm staging scripts, tests, and release
workflow are original integration code.

`release/rusty-v8-checksums` pins the archive and generated-binding hashes from
the upstream `rusty-v8-v149.2.0` release. Release builds use these checked-in
manifests rather than trusting checksums downloaded beside the payloads.
