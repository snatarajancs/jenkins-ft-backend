#!/usr/bin/env bash

###############################################################################
#
# File        : 12-push-image.sh
# Description : Push Docker images to container registry.
#
# Responsibilities
#   - Load registry configuration from environment profile
#   - Authenticate to container registry
#   - Push built Docker images
#   - Always attempt registry logout after successful login
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
source "${JENKINS_DIR}/common.sh"

# shellcheck disable=SC1091
source "${JENKINS_DIR}/helpers/runtime.sh"

# shellcheck disable=SC1091
source "${JENKINS_DIR}/helpers/registry.sh"

###############################################################################
# Runtime State
###############################################################################

REGISTRY_LOGIN_SUCCESS=false

###############################################################################
# Cleanup
###############################################################################

cleanup() {

    local exit_code=$?

    if [[ "${REGISTRY_LOGIN_SUCCESS}" == "true" ]]; then

        log_info "Logging out from container registry..."

        if ! registry_logout; then
            log_warn "Registry logout failed."
        fi

    fi

    return "${exit_code}"
}

trap cleanup EXIT

###############################################################################
# Push Images
###############################################################################

push_images() {

    local components
    local component
    local repository
    local tag
    local pushed_count=0

    ###########################################################################
    # Read components from Docker image metadata
    ###########################################################################
    
    components="$(
        jq -er 'keys[]' "${IMAGE_METADATA_FILE}"
    )" || die "Failed to read Docker image metadata."

    ###########################################################################
    # Push each built image
    ###########################################################################

    while read -r component
    do

        [[ -n "${component}" ]] || continue

        repository="$(
            runtime_get_image "${component}" repository
        )" || die "${component}: Failed to read image repository."

        tag="$(
            runtime_get_image "${component}" tag
        )" || die "${component}: Failed to read image tag."

        [[ -n "${repository}" ]] ||
            die "${component}: Repository is empty."

        [[ -n "${tag}" ]] ||
            die "${component}: Image tag is empty."

        log_info "Preparing image push..."
        log_info "Component  : ${component}"
        log_info "Repository : ${repository}"
        log_info "Tag        : ${tag}"

        #######################################################################
        # Push image
        #######################################################################

        registry_push \
            "${repository}" \
            "${tag}"

        pushed_count=$((pushed_count + 1))

        log_success "${component}: Image pushed successfully."

    done <<< "${components}"
    
    ###########################################################################
    # Safety check
    ###########################################################################

    if (( pushed_count == 0 )); then
        die "No Docker images were pushed."
    fi

    log_success \
        "Successfully pushed ${pushed_count} Docker image(s)."
}

###############################################################################
# Main
###############################################################################

main() {

    log_header "Push Docker Images"

    ###########################################################################
    # Required commands
    ###########################################################################

    require_command docker
    require_command jq
    require_command yq

    ###########################################################################
    # Load profile-based registry configuration
    ###########################################################################

    registry_load_profile


    ###########################################################################
    # Login
    ###########################################################################

    registry_login

    REGISTRY_LOGIN_SUCCESS=true

    ###########################################################################
    # Push images
    ###########################################################################

    push_images

    log_success "Docker image push completed successfully."
}

###############################################################################
# Entry Point
###############################################################################

main "$@"
