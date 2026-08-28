#!/usr/bin/env bash

###############################################################################
#
# File        : 06-code-quality.sh
# Description : Run code quality checks.
#
# Responsibilities
#   - Run code quality tools for each project component
#
###############################################################################

set -Eeuo pipefail

###############################################################################
# Paths
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JENKINS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_ROOT="$(cd "${JENKINS_DIR}/.." && pwd)"

###############################################################################
# Load Libraries
###############################################################################

# shellcheck disable=SC1091
source "${JENKINS_DIR}/common.sh"

# shellcheck disable=SC1091
source "${JENKINS_DIR}/helpers/json.sh"

###############################################################################
# Public Functions
###############################################################################

run_code_quality() {

    [[ $# -eq 0 ]] || die "Usage: run_code_quality"

    require_file "${PROJECT_FILE}"

    log_info "Running code quality checks..."

    local component
    local source
    local source_dir
    local build_tool

    while read -r component
    do
        [[ -n "${component}" ]] || continue

        log_info "Checking component: ${component}"

        source="$(json_get "${PROJECT_FILE}" ".components.${component}.source")"
        build_tool="$(json_get_optional "${PROJECT_FILE}" ".components.${component}.build.tool")"

        source_dir="${PROJECT_ROOT}/${source}"

        require_directory "${source_dir}"

        log_info "Source directory : ${source_dir}"
        log_info "Build tool       : ${build_tool:-N/A}"

        pushd "${source_dir}" >/dev/null

        case "${build_tool}" in

            go)
                require_command golangci-lint
                golangci-lint run
                ;;

            npm)
                require_command npm
                npm run lint
                ;;

            pnpm)
                require_command pnpm
                pnpm lint
                ;;

            yarn)
                require_command yarn
                yarn lint
                ;;

            bun)
                require_command bun
                bun run lint
                ;;

            pip)
                require_command ruff
                ruff check .
                ;;

            poetry)
                require_command poetry
                poetry run ruff check .
                ;;

            "")
                log_info "${component}: No code quality checks required."
                ;;

            *)
                popd >/dev/null
                die "${component}: Unsupported build tool '${build_tool}'."
                ;;

        esac

        popd >/dev/null

        log_success "${component}: Code quality checks passed."

    done < <(
        json_keys "${PROJECT_FILE}" ".components"
    )

    log_success "Code quality checks completed."
}

###############################################################################
# Main
###############################################################################

main() {

    log_header "Code Quality"

    run_code_quality

}

main "$@"