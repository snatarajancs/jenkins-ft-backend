#!/usr/bin/env bash

###############################################################################
#
# File        : 05-install-dependencies.sh
# Description : Install project dependencies.
#
# Responsibilities
#   - Read component configuration
#   - Validate component source directories
#   - Install dependencies using the configured build tool
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
# Install Dependencies
###############################################################################

install_dependencies() {

    [[ $# -eq 0 ]] || die "Usage: install_dependencies"

    require_file "${PROJECT_FILE}"

    log_info "Installing project dependencies..."

    local component
    local component_source
    local build_tool
    local component_dir

    while IFS= read -r component
    do
        [[ -n "${component}" ]] || continue

        log_info "Installing dependencies: ${component}"

        component_source="$(json_get \
            "${PROJECT_FILE}" \
            ".components.${component}.source")"

        build_tool="$(json_get_optional \
            "${PROJECT_FILE}" \
            ".components.${component}.build.tool")"

        [[ -n "${component_source}" ]] \
            || die "${component}: Component source is not configured."

        component_dir="${PROJECT_ROOT}/${component_source}"

        require_directory "${component_dir}"

        log_info "Source directory : ${component_dir}"
        log_info "Build tool       : ${build_tool:-none}"

        case "${build_tool}" in

            npm)

                require_command npm

                require_file "${component_dir}/package.json"
                require_file "${component_dir}/package-lock.json"

                (
                    cd "${component_dir}"
                    npm ci
                )
                ;;

            pnpm)

                require_command pnpm

                require_file "${component_dir}/package.json"
                require_file "${component_dir}/pnpm-lock.yaml"

                (
                    cd "${component_dir}"
                    pnpm install --frozen-lockfile
                )
                ;;

            yarn)

                require_command yarn

                require_file "${component_dir}/package.json"
                require_file "${component_dir}/yarn.lock"

                (
                    cd "${component_dir}"
                    yarn install --frozen-lockfile
                )
                ;;

            bun)

                require_command bun

                require_file "${component_dir}/package.json"

                if [[ -f "${component_dir}/bun.lock" ||
                      -f "${component_dir}/bun.lockb" ]]
                then
                    (
                        cd "${component_dir}"
                        bun install --frozen-lockfile
                    )
                else
                    die "${component}: bun lockfile not found."
                fi
                ;;

            go)

                require_command go
                require_file "${component_dir}/go.mod"

                (
                    cd "${component_dir}"
                    go mod download
                )
                ;;

            pip)

                require_command python3
                require_file "${component_dir}/requirements.txt"

                (
                    cd "${component_dir}"
                    python3 -m pip install -r requirements.txt
                )
                ;;

            poetry)

                require_command poetry
                require_file "${component_dir}/pyproject.toml"

                (
                    cd "${component_dir}"
                    poetry install --no-interaction
                )
                ;;

            ""|"null")

                log_info "${component}: No dependency installation required."
                continue
                ;;

            *)

                die "${component}: Unsupported build tool '${build_tool}'."
                ;;

        esac

        log_success "${component}: Dependencies installed."

    done < <(
        json_keys "${PROJECT_FILE}" ".components"
    )

    log_success "Dependency installation completed."
}

###############################################################################
# Main
###############################################################################

main() {

    log_header "Install Dependencies"

    install_dependencies
}

main "$@"
