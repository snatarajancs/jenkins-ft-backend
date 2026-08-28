#!/usr/bin/env bash

###############################################################################
#
# File        : component.sh
# Description : Component execution helper.
#
# Responsibilities
#   - Iterate project components
#   - Process changed components when available
#   - Resolve simple dependencies
#   - Execute callback function
#
###############################################################################

set -Eeuo pipefail

###############################################################################
# Paths
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JENKINS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

###############################################################################
# Load Libraries
###############################################################################

# shellcheck disable=SC1091
source "${JENKINS_DIR}/helpers/json.sh"

# shellcheck disable=SC1091
source "${JENKINS_DIR}/helpers/runtime.sh"

###############################################################################
# Internal State
###############################################################################

declare -A COMPONENT_VISITED

###############################################################################
# Internal Functions
###############################################################################

run_component() {

    local callback="$1"
    local component="$2"

    #
    # Skip if already processed.
    #
    [[ -n "${COMPONENT_VISITED[$component]:-}" ]] && return

    #
    # Ensure component exists.
    #
    json_exists \
        "${PROJECT_FILE}" \
        ".components.${component}" \
        || die "Unknown component: ${component}"

    #
    # Process dependencies first.
    #
    if json_exists "${PROJECT_FILE}" ".components.${component}.depends_on"; then

        local dependency

        while read -r dependency
        do
            [[ -z "${dependency}" ]] && continue

            run_component "${callback}" "${dependency}"

        done < <(
            json_array \
                "${PROJECT_FILE}" \
                ".components.${component}.depends_on"
        )

    fi

    COMPONENT_VISITED["${component}"]=1

    "${callback}" "${component}"
}

###############################################################################
# Public Functions
###############################################################################

for_each_component() {

    [[ $# -eq 1 ]] || die "Usage: for_each_component <callback>"

    local callback="$1"
    local component
    local changed_count

    declare -F "${callback}" >/dev/null \
        || die "Unknown callback: ${callback}"

    COMPONENT_VISITED=()

    ###########################################################################
    # Incremental build
    ###########################################################################

    if [[ -f "${SOURCE_CHANGES_FILE}" ]]; then

        changed_count="$(
            json_get \
                "${SOURCE_CHANGES_FILE}" \
                ".changed_component_count"
        )"

        if [[ "${changed_count}" -gt 0 ]]; then

            log_info "Using incremental build components."
            log_info "Changed component count: ${changed_count}"

            while read -r component
            do
                [[ -z "${component}" ]] && continue

                run_component "${callback}" "${component}"

            done < <(
                json_array \
                    "${SOURCE_CHANGES_FILE}" \
                    ".changed_components"
            )

            return
        fi

        #######################################################################
        # No component changes
        #######################################################################

        log_info "No component changes detected."
        log_info "Using all project components."

    else

        #######################################################################
        # Source change file unavailable
        #######################################################################

        log_info "Source change information unavailable."
        log_info "Using all project components."

    fi

    ###########################################################################
    # Full build
    ###########################################################################

    while read -r component
    do
        [[ -z "${component}" ]] && continue

        run_component "${callback}" "${component}"

    done < <(
        json_keys \
            "${PROJECT_FILE}" \
            ".components"
    )
}