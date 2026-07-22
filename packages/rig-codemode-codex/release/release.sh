#!/usr/bin/env bash

set -euo pipefail

package_name="@slopus/rig-codemode-codex"
github_repository="slopus/rig"
upstream_url="https://github.com/slopus/rig.git"
workflow_file="publish-rig-codemode-codex.yml"
github_environment="npm"
npm_registry="https://registry.npmjs.org/"
npm_cli_version="11.18.0"
bootstrap_version="0.0.0-bootstrap.0"
temporary_root="${TMPDIR:-/tmp}"
temporary_root="${temporary_root%/}"

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(git -C "${script_directory}" rev-parse --show-toplevel)"

assume_yes=false
skip_wait=false
release_version=""
temporary_directories=()

usage() {
    cat <<'EOF'
Release every @slopus/rig-codemode-codex platform package through GitHub Actions.

Usage:
  pnpm --filter @slopus/rig-codemode-codex release -- [options]

Options:
  --version <x.y.z>  Release this version. Defaults to package.json.
  --yes              Skip the final interactive confirmation.
  --skip-wait        Return after pushing the tag instead of watching the workflow.
  -h, --help         Show this help.

On the first release, the script also:
  - publishes 0.0.0-bootstrap.0 under the non-default "bootstrap" tag;
  - creates the GitHub "npm" environment;
  - configures npm trusted publishing for slopus/rig.

The script never commits or pushes a branch. The clean current commit must already
be the exact commit at https://github.com/slopus/rig main.
EOF
}

fail() {
    printf 'Release failed: %s\n' "$*" >&2
    exit 1
}

cleanup() {
    local directory
    set +u
    for directory in "${temporary_directories[@]}"; do
        if [[ -d "${directory}" && "${directory}" == "${temporary_root}"/rig-codemode-*.?????? ]]; then
            rm -rf -- "${directory}"
        fi
    done
}

trap cleanup EXIT

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "required command '$1' is unavailable."
}

npm_cli() {
    pnpm --silent dlx "npm@${npm_cli_version}" "$@"
}

package_version_exists() {
    local result
    if "${script_directory}/npm-version-exists.sh" "${package_name}@$1"; then
        return 0
    else
        result=$?
    fi

    if [[ "${result}" -eq 1 ]]; then
        return 1
    fi
    fail "could not determine whether ${package_name}@$1 exists."
}

registry_package_exists() {
    local result
    if "${script_directory}/npm-version-exists.sh" "${package_name}"; then
        return 0
    else
        result=$?
    fi

    if [[ "${result}" -eq 1 ]]; then
        return 1
    fi
    fail "could not determine whether ${package_name} exists."
}

wait_for_package_version() {
    local version="$1"
    local attempt
    for attempt in $(seq 1 30); do
        if package_version_exists "${version}"; then
            return 0
        fi
        sleep 2
    done
    fail "${package_name}@${version} did not appear on npm."
}

ensure_npm_login() {
    if npm_cli whoami --registry="${npm_registry}" >/dev/null 2>&1; then
        return
    fi

    printf 'npm authentication is required for initial trusted-publisher setup.\n'
    npm_cli login --registry="${npm_registry}"
    npm_cli whoami --registry="${npm_registry}" >/dev/null
}

trusted_publisher_status() {
    local trust_json="$1"
    printf '%s' "${trust_json}" | node "${script_directory}/check-trusted-publisher.mjs"
}

ensure_trusted_publisher() {
    local trust_json
    local status
    trust_json="$(read_trusted_publisher)"

    if trusted_publisher_status "${trust_json}"; then
        printf 'npm trusted publisher already targets %s.\n' "${github_repository}"
        return
    else
        status=$?
    fi

    if [[ "${status}" -ne 2 ]]; then
        printf '%s\n' "${trust_json}" >&2
        fail "an existing npm trusted publisher does not match ${github_repository}; refusing to replace it."
    fi

    npm_cli trust github "${package_name}" \
        --repo "${github_repository}" \
        --file "${workflow_file}" \
        --env "${github_environment}" \
        --allow-publish \
        --registry "${npm_registry}" \
        --yes
}

read_trusted_publisher() {
    local attempt
    local error_log
    local trust_json
    error_log="$(mktemp "${temporary_root}/rig-codemode-npm-trust.XXXXXX")"

    for attempt in $(seq 1 15); do
        if trust_json="$(
            npm_cli trust list "${package_name}" --json --registry="${npm_registry}" \
                2>"${error_log}"
        )"; then
            rm -f -- "${error_log}"
            printf '%s' "${trust_json}"
            return
        fi

        if grep -Eq 'E404|(^|[^0-9])404([^0-9]|$)' "${error_log}"; then
            sleep 2
            continue
        fi

        cat "${error_log}" >&2
        rm -f -- "${error_log}"
        fail "could not inspect npm trusted publishing."
    done

    cat "${error_log}" >&2
    rm -f -- "${error_log}"
    fail "npm trusted-publisher endpoint did not observe the package."
}

publish_bootstrap_package() {
    local release_directory="$1"
    local tarball="${release_directory}/slopus-rig-codemode-codex-${bootstrap_version}.tgz"

    if package_version_exists "${bootstrap_version}"; then
        printf '%s@%s already exists; skipping bootstrap publication.\n' \
            "${package_name}" "${bootstrap_version}"
        return
    fi

    pnpm --filter "${package_name}" package:root -- \
        --version "${bootstrap_version}" \
        --output "${release_directory}"

    [[ -f "${tarball}" ]] || fail "bootstrap tarball was not generated at ${tarball}."
    npm_cli publish "${tarball}" \
        --access public \
        --tag bootstrap \
        --provenance=false \
        --registry "${npm_registry}"
    wait_for_package_version "${bootstrap_version}"
}

preflight_local_sandbox() {
    if [[ "${skip_wait}" == true ]]; then
        return
    fi

    case "$(uname -s)" in
        Darwin)
            [[ -f /usr/bin/sandbox-exec && -x /usr/bin/sandbox-exec ]] || \
                fail "the installed-package smoke test requires /usr/bin/sandbox-exec."
            ;;
        Linux)
            local bubblewrap
            for bubblewrap in /usr/bin/bwrap /bin/bwrap /usr/local/bin/bwrap; do
                if [[ -f "${bubblewrap}" && -x "${bubblewrap}" ]]; then
                    return
                fi
            done
            fail "the installed-package smoke test requires Bubblewrap (bwrap)."
            ;;
    esac
}

find_workflow_run() {
    gh run list \
        --repo "${github_repository}" \
        --workflow "${workflow_file}" \
        --limit 30 \
        --json databaseId,headBranch,headSha \
        --jq "first(.[] | select(.headBranch == \"${release_tag}\" and .headSha == \"${head_commit}\") | .databaseId) // \"\""
}

watch_workflow_run() {
    local run_id="$1"
    local run_status
    local run_conclusion
    run_status="$(
        gh run view "${run_id}" --repo "${github_repository}" --json status --jq .status
    )"
    run_conclusion="$(
        gh run view "${run_id}" --repo "${github_repository}" --json conclusion --jq .conclusion
    )"

    if [[ "${run_status}" == "completed" && "${run_conclusion}" != "success" ]]; then
        local attempt
        printf 'Re-running unsuccessful GitHub Actions run %s (%s).\n' \
            "${run_id}" "${run_conclusion}"
        gh run rerun "${run_id}" --repo "${github_repository}"
        for attempt in $(seq 1 15); do
            run_status="$(
                gh run view "${run_id}" --repo "${github_repository}" --json status --jq .status
            )"
            if [[ "${run_status}" != "completed" ]]; then
                break
            fi
            sleep 2
        done
        [[ "${run_status}" != "completed" ]] || fail "GitHub did not start run ${run_id}."
    fi

    gh run watch "${run_id}" --repo "${github_repository}" --exit-status
}

wait_for_workflow() {
    local run_id=""
    local attempt
    printf 'Waiting for GitHub Actions to register %s...\n' "${release_tag}"
    for attempt in $(seq 1 30); do
        run_id="$(find_workflow_run)"
        if [[ -n "${run_id}" ]]; then
            watch_workflow_run "${run_id}"
            return
        fi
        sleep 2
    done
    if [[ "${remote_tag_preexisting}" == true ]]; then
        printf 'No retained run exists; dispatching the workflow from %s.\n' "${release_tag}"
        gh workflow run "${workflow_file}" --repo "${github_repository}" --ref "${release_tag}"
        for attempt in $(seq 1 30); do
            run_id="$(find_workflow_run)"
            if [[ -n "${run_id}" ]]; then
                watch_workflow_run "${run_id}"
                return
            fi
            sleep 2
        done
    fi
    fail "could not find the ${workflow_file} run for ${release_tag}."
}

verify_release() {
    local suffix
    local expected_versions=(
        "${release_version}"
        "${release_version}-darwin-arm64"
        "${release_version}-darwin-x64"
        "${release_version}-linux-arm64"
        "${release_version}-linux-x64"
        "${release_version}-win32-arm64"
        "${release_version}-win32-x64"
    )

    printf 'Verifying all npm versions...\n'
    for suffix in "${expected_versions[@]}"; do
        wait_for_package_version "${suffix}"
        printf '  %s@%s\n' "${package_name}" "${suffix}"
    done

    local latest
    latest="$(pnpm view "${package_name}" dist-tags.latest --registry="${npm_registry}")"
    [[ "${latest}" == "${release_version}" ]] || \
        fail "npm latest points to ${latest}, expected ${release_version}."
}

smoke_test_release() {
    local smoke_directory
    preflight_local_sandbox
    smoke_directory="$(mktemp -d "${temporary_root}/rig-codemode-smoke.XXXXXX")"
    temporary_directories+=("${smoke_directory}")

    node -e \
        'require("node:fs").writeFileSync(process.argv[1], "{\"name\":\"rig-codemode-release-smoke\",\"private\":true}\n")' \
        "${smoke_directory}/package.json"
    pnpm --dir "${smoke_directory}" add --save-exact "${package_name}@${release_version}"
    (
        cd "${smoke_directory}"
        node --input-type=module <<'EOF'
import { runCode } from "@slopus/rig-codemode-codex";

const sandbox = process.platform === "win32" ? "auto" : "required";
const result = await runCode("text(6 * 7);", { sandbox });
if (result.text !== "42") {
    throw new Error(`Unexpected Code Mode result: ${JSON.stringify(result)}`);
}
EOF
    )
    printf 'Installed-package smoke test passed on %s %s.\n' "$(uname -s)" "$(uname -m)"
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --version)
            [[ $# -ge 2 ]] || fail "--version requires a value."
            release_version="$2"
            shift 2
            ;;
        --yes)
            assume_yes=true
            shift
            ;;
        --skip-wait)
            skip_wait=true
            shift
            ;;
        --)
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            fail "unknown option '$1'."
            ;;
    esac
done

require_command git
require_command gh
require_command node
require_command pnpm

cd "${repository_root}"

manifest_version="$(node -p "require('./packages/rig-codemode-codex/package.json').version")"
manifest_repository="$(node -p "require('./packages/rig-codemode-codex/package.json').repository.url")"
release_version="${release_version:-${manifest_version}}"
release_tag="rig-codemode-codex-v${release_version}"
head_commit="$(git rev-parse HEAD)"

[[ "${release_version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || \
    fail "release version must have the stable x.y.z form."
[[ "${release_version}" == "${manifest_version}" ]] || \
    fail "requested version ${release_version} does not match package.json ${manifest_version}."
[[ "${manifest_repository}" == "git+https://github.com/slopus/rig.git" ]] || \
    fail "package repository must be git+https://github.com/slopus/rig.git."
[[ -f ".github/workflows/${workflow_file}" ]] || fail "release workflow is missing."
[[ -z "$(git status --porcelain)" ]] || fail "the worktree is not clean."

remote_main="$(git ls-remote "${upstream_url}" refs/heads/main | awk 'NR == 1 { print $1 }')"
[[ -n "${remote_main}" ]] || fail "could not resolve ${upstream_url} main."
[[ "${head_commit}" == "${remote_main}" ]] || \
    fail "HEAD ${head_commit} is not the current slopus/rig main commit ${remote_main}."

gh auth status --hostname github.com >/dev/null
pnpm view npm version --registry="${npm_registry}" >/dev/null

if package_version_exists "${release_version}"; then
    printf '%s@%s is already published. Verifying it.\n' "${package_name}" "${release_version}"
    verify_release
    smoke_test_release
    exit 0
fi

package_exists=false
if registry_package_exists; then
    package_exists=true
fi

remote_tag_lines="$(git ls-remote "${upstream_url}" "refs/tags/${release_tag}" "refs/tags/${release_tag}^{}")"
remote_tag_commit="$(printf '%s\n' "${remote_tag_lines}" | awk '/\^\{\}$/ { print $1; found=1 } END { if (!found && NR > 0) print first } NR == 1 { first=$1 }')"
remote_tag_preexisting=false
if [[ -n "${remote_tag_commit}" ]]; then
    remote_tag_preexisting=true
fi
if [[ -n "${remote_tag_commit}" && "${remote_tag_commit}" != "${head_commit}" ]]; then
    fail "remote tag ${release_tag} already points somewhere else."
fi

local_tag_exists=false
if git rev-parse -q --verify "refs/tags/${release_tag}" >/dev/null; then
    local_tag_exists=true
    local_tag_commit="$(git rev-list -n 1 "${release_tag}")"
    [[ "${local_tag_commit}" == "${head_commit}" ]] || \
        fail "local tag ${release_tag} already points somewhere else."
fi

printf '\nRelease plan\n'
printf '  package:    %s@%s\n' "${package_name}" "${release_version}"
printf '  source:     %s@%s\n' "${github_repository}" "${head_commit}"
printf '  tag:        %s\n' "${release_tag}"
printf '  platforms:  macOS, Linux, and Windows on arm64 and x64\n'
if [[ "${package_exists}" == false ]]; then
    printf '  bootstrap:  publish %s under the bootstrap dist-tag\n' "${bootstrap_version}"
fi

printf '\nRunning release checks...\n'
preflight_local_sandbox
pnpm install --frozen-lockfile
pnpm --filter "${package_name}" check
pnpm --filter "${package_name}" test
pnpm --filter "${package_name}" test:native
[[ -z "$(git status --porcelain)" ]] || fail "release checks changed tracked or untracked files."

if [[ "${assume_yes}" == false ]]; then
    printf '\nType %s to publish and push the release tag: ' "${release_version}"
    read -r confirmation
    [[ "${confirmation}" == "${release_version}" ]] || fail "release was not confirmed."
fi

ensure_npm_login
if gh api --hostname github.com "repos/${github_repository}/environments/${github_environment}" >/dev/null 2>&1; then
    printf 'GitHub environment %s already exists.\n' "${github_environment}"
else
    gh api --hostname github.com --method PUT \
        "repos/${github_repository}/environments/${github_environment}" >/dev/null
fi

release_directory="$(mktemp -d "${temporary_root}/rig-codemode-release.XXXXXX")"
temporary_directories+=("${release_directory}")
if [[ "${package_exists}" == false ]]; then
    publish_bootstrap_package "${release_directory}"
fi
ensure_trusted_publisher

if [[ -z "${remote_tag_commit}" ]]; then
    if [[ "${local_tag_exists}" == false ]]; then
        git tag -a "${release_tag}" -m "${package_name} ${release_version}"
    fi
    git push "${upstream_url}" "refs/tags/${release_tag}:refs/tags/${release_tag}"
else
    printf 'Remote tag %s already exists at this commit; reusing its workflow run.\n' "${release_tag}"
fi

if [[ "${skip_wait}" == true ]]; then
    printf 'Release tag pushed. Follow the workflow at https://github.com/%s/actions/workflows/%s\n' \
        "${github_repository}" "${workflow_file}"
    exit 0
fi

wait_for_workflow
verify_release
smoke_test_release

printf '\nReleased %s@%s from %s.\n' "${package_name}" "${release_version}" "${head_commit}"
