#!/usr/bin/env bash
set -euo pipefail

: "${TARGET:?TARGET is required}"
: "${GITHUB_ENV:?GITHUB_ENV is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

version="149.2.0"
release_tag="rusty-v8-v${version}"
base_url="https://github.com/openai/codex/releases/download/${release_tag}"
artifact_dir="${RUNNER_TEMP}/codemode-rusty-v8"
archive="${artifact_dir}/librusty_v8_release_${TARGET}.a.gz"
binding="${artifact_dir}/src_binding_release_${TARGET}.rs"
checksums="${artifact_dir}/rusty_v8_release_${TARGET}.sha256"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
trusted_checksums="${script_dir}/rusty-v8-checksums/${TARGET}.sha256"

mkdir -p "${artifact_dir}"
curl -fsSL "${base_url}/librusty_v8_release_${TARGET}.a.gz" -o "${archive}"
curl -fsSL "${base_url}/src_binding_release_${TARGET}.rs" -o "${binding}"
cp "${trusted_checksums}" "${checksums}"

expected_archive="$(basename "${archive}")"
expected_binding="$(basename "${binding}")"
first_file="$(awk 'NR == 1 { print $2 }' "${checksums}")"
second_file="$(awk 'NR == 2 { print $2 }' "${checksums}")"
if [[ "$(wc -l < "${checksums}")" -ne 2 ]] ||
    [[ "${first_file}" != "${expected_archive}" ]] ||
    [[ "${second_file}" != "${expected_binding}" ]]; then
    echo "Expected exactly two rusty_v8 checksums for ${TARGET}." >&2
    exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
    (cd "${artifact_dir}" && sha256sum -c "${checksums}")
else
    (cd "${artifact_dir}" && shasum -a 256 -c "${checksums}")
fi

echo "RUSTY_V8_ARCHIVE=${archive}" >> "${GITHUB_ENV}"
echo "RUSTY_V8_SRC_BINDING_PATH=${binding}" >> "${GITHUB_ENV}"
