#!/usr/bin/env bash

###############################################################################
#
# File        : 08-build-application.sh
# Description : Build project applications.
#
# Responsibilities
#   - Build application artifacts for each project component
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

build_applications() {

    [[ $# -eq 0 ]] || die "Usage: build_applications"

    require_file "${PROJECT_FILE}"

    log_info "Building project applications..."

    local component
    local source
    local source_dir
    local build_tool
    local artifact_directory
    local artifact_path

    while read -r component
    do
        [[ -n "${component}" ]] || continue

        log_info "Building component: ${component}"

        source="$(json_get "${PROJECT_FILE}" ".components.${component}.source")"
        build_tool="$(json_get_optional "${PROJECT_FILE}" ".components.${component}.build.tool")"
        artifact_directory="$(
            json_get_optional \
                "${PROJECT_FILE}" \
                ".components.${component}.build.artifact_directory"
        )"

        if [[ -z "${build_tool}" ]]; then
            log_info "${component}: No build configured. Skipping."
            continue
        fi

        source_dir="${PROJECT_ROOT}/${source}"

        require_directory "${source_dir}"

        log_info "Source directory : ${source_dir}"
        log_info "Build tool       : ${build_tool}"
        log_info "Artifact         : ${artifact_directory:-N/A}"

        pushd "${source_dir}" >/dev/null

        case "${build_tool}" in

            go)
                require_command go
                go build ./...
                ;;

            npm)
                require_command npm
                npm run build
                ;;

            pnpm)
                require_command pnpm
                pnpm run build
                ;;

            yarn)
                require_command yarn
                yarn build
                ;;

            bun)
                require_command bun
                bun run build
                ;;

            pip)
                log_info "${component}: No build step required."
                ;;

            poetry)
                require_command poetry
                poetry build
                ;;

            *)
                popd >/dev/null
                die "${component}: Unsupported build tool '${build_tool}'."
                ;;

        esac

        if [[ -n "${artifact_directory}" ]]; then

            artifact_path="${source_dir}/${artifact_directory}"

            require_directory "${artifact_path}"

            log_info "${component}: Build artifact verified: ${artifact_directory}"

        fi

        popd >/dev/null

        log_success "${component}: Build completed."

    done < <(
        json_keys "${PROJECT_FILE}" ".components"
    )

    log_success "Application build completed."
}

###############################################################################
# Main
###############################################################################

main() {

    log_header "Build Application"

    build_applications

}

main "$@"