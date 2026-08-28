#!/usr/bin/env bash

###############################################################################
#
# File        : deployment.sh
# Description : Deployment dispatcher.
#
# Responsibilities
#   - Determine deployment implementation from environment profile
#   - Route to the correct deployment implementation
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

# shellcheck disable=SC1091
source "${JENKINS_DIR}/deployment/compose.sh"

# shellcheck disable=SC1091
source "${JENKINS_DIR}/deployment/ecs.sh"

# shellcheck disable=SC1091
source "${JENKINS_DIR}/deployment/s3.sh"

###############################################################################
# Public Functions
###############################################################################

#
# Execute deployment for a component.
#
# Usage:
#   deployment_execute <component>
#
deployment_execute() {

    local component="$1"

    local profile
    local profile_file
    local deployment_type

    ###########################################################################
    # Read active profile from runtime context.
    ###########################################################################

    profile="$(
        json_get_optional \
            "${PIPELINE_CONTEXT_FILE}" \
            ".profile"
    )"

    if [[ -z "${profile}" || "${profile}" == "none" ]]; then
        log_info "${component}: No deployment profile configured. Deployment skipped."
        return
    fi

    ###########################################################################
    # Resolve profile file.
    ###########################################################################

    profile_file="${JENKINS_DIR}/config/profiles/${profile}.yaml"

    if [[ ! -f "${profile_file}" ]]; then
        die "${component}: Deployment profile not found: ${profile_file}"
    fi

    ###########################################################################
    # Read deployment implementation from profile.
    ###########################################################################

    deployment_type="$(
        yq -er '.deployment.type' \
            "${profile_file}"
    )"

    log_info "Component       : ${component}"
    log_info "Profile         : ${profile}"
    log_info "Deployment Type : ${deployment_type}"

    ###########################################################################
    # Route deployment.
    ###########################################################################

    case "${deployment_type}" in

        docker-compose)
            deployment_compose "${component}"
            ;;

        ecs)
            deployment_ecs "${component}"
            ;;

        s3)
            deployment_s3 "${component}"
            ;;

        none)
            log_info "${component}: Deployment disabled."
            ;;

        *)
            die "${component}: Unsupported deployment type '${deployment_type}'."
            ;;

    esac
}