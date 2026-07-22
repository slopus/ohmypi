#!/usr/bin/env bash

set -uo pipefail

if [[ $# -ne 1 ]]; then
    printf 'Usage: npm-version-exists.sh <package-spec>\n' >&2
    exit 2
fi

npm_registry="https://registry.npmjs.org/"
temporary_root="${TMPDIR:-/tmp}"
temporary_root="${temporary_root%/}"
error_log="$(mktemp "${temporary_root}/rig-codemode-npm-view.XXXXXX")"

cleanup() {
    rm -f -- "${error_log}"
}

trap cleanup EXIT

if pnpm view "$1" version --registry="${npm_registry}" >/dev/null 2>"${error_log}"; then
    exit 0
fi

if grep -Eq 'E404|ERR_PNPM_FETCH_404|(^|[^0-9])404([^0-9]|$)' "${error_log}"; then
    exit 1
fi

cat "${error_log}" >&2
exit 2
