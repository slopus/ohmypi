# Third-party notices

This package includes source code from OpenAI Codex at commit
`37eef7baccebaeb00e42a88b323054cdbfe418c5`. That source is licensed under the
Apache License 2.0; see `LICENSE-CODEX`.

The native binary statically links the Rust dependencies recorded in
`native/Cargo.lock`, including `rusty_v8`. Consumers can inspect the lockfile
for the exact dependency versions used by this package.
