#!/usr/bin/env bash

###############################################################################
#
# File        : 07-run-tests.sh
# Description : Run project test suites.
#
# Responsibilities
#   - Execute configured test suites for each project component
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

run_tests() {

    [[ $# -eq 0 ]] || die "Usage: run_tests"

    require_file "${PROJECT_FILE}"

    log_info "Running project test suites..."

    local component
    local source
    local source_dir
    local build_tool
    local testing_enabled

    while read -r component
    do
        [[ -n "${component}" ]] || continue

        log_info "Testing component: ${component}"

        source="$(json_get "${PROJECT_FILE}" ".components.${component}.source")"
        build_tool="$(json_get_optional "${PROJECT_FILE}" ".components.${component}.build.tool")"

        if ! json_exists \
            "${PROJECT_FILE}" \
            ".components.${component}.testing.unit"; then

            log_info "${component}: Unit test configuration not found. Skipping."
            continue
        fi

        testing_enabled="$(
            json_get_optional \
                "${PROJECT_FILE}" \
                ".components.${component}.testing.unit.enabled"
        )"

        if [[ "${testing_enabled}" != "true" ]]; then
            log_info "${component}: Unit tests disabled. Skipping."
            continue
        fi

        test_script="$(
            json_get_optional \
                "${PROJECT_FILE}" \
                ".components.${component}.testing.unit.script"
        )"

        if [[ -z "${test_script}" ]]; then
            die "${component}: Unit test script is not configured."
        fi        

        source_dir="${PROJECT_ROOT}/${source}"

        require_directory "${source_dir}"

        log_info "Source directory : ${source_dir}"
        log_info "Build tool       : ${build_tool:-N/A}"

        pushd "${source_dir}" >/dev/null

        case "${build_tool}" in

            go)
                require_command go
                bash -c "${test_script}"
                ;;

            npm)
                require_command npm
                bash -c "${test_script}"
                ;;

            pnpm)
                require_command pnpm
                bash -c "${test_script}"
                ;;

            yarn)
                require_command yarn
                bash -c "${test_script}"
                ;;

            bun)
                require_command bun
                bash -c "${test_script}"
                ;;

            pip)
                require_command pytest
                bash -c "${test_script}"
                ;;

            poetry)
                require_command poetry
                bash -c "${test_script}"
                ;;

            "")
                popd >/dev/null
                die "${component}: Tests are enabled but no build tool is configured."
                ;;

            *)
                popd >/dev/null
                die "${component}: Unsupported build tool: ${build_tool}"
                ;;
        esac

        popd >/dev/null

        log_success "${component}: Tests passed."

    done < <(
        json_keys "${PROJECT_FILE}" ".components"
    )

    log_success "Project test suites completed."
}

###############################################################################
# Main
###############################################################################

main() {

    log_header "Run Tests"

    run_tests

}

main "$@"