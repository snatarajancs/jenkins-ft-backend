#!/usr/bin/env bash

###############################################################################
#
# File        : registry.sh
# Description : Container registry helper library.
#
# Responsibilities
#   - Load registry configuration from environment profile
#   - Authenticate to container registry
#   - Push Docker images
#   - Logout from container registry
#
###############################################################################

set -Eeuo pipefail

###############################################################################
# Paths
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JENKINS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

###############################################################################
# Load Registry Profile
###############################################################################

registry_load_profile() {

    local profile
    local profile_file

    require_command jq
    require_command yq

    profile="$(
        jq -er '.profile' \
            "${JENKINS_DIR}/runtime/pipeline-context.json"
    )"

    if [[ -z "${profile}" || "${profile}" == "none" ]]; then
        die "Deployment profile is not available."
    fi

    profile_file="${JENKINS_DIR}/config/profiles/${profile}.yaml"

    if [[ ! -f "${profile_file}" ]]; then
        die "Profile file not found: ${profile_file}"
    fi

    REGISTRY_TYPE="$(
        yq -er '.registry.type' "${profile_file}"
    )"

    REGISTRY_URL="$(
        yq -er '.registry.url' "${profile_file}"
    )"

    REGISTRY_NAMESPACE="$(
        yq -er '.registry.namespace' "${profile_file}"
    )"

    if [[ "${REGISTRY_TYPE}" == "ecr" ]]; then

        AWS_REGION="$(
            yq -er '.registry.aws_region' "${profile_file}"
        )"

    else

        AWS_REGION=""

    fi

    export REGISTRY_TYPE
    export REGISTRY_URL
    export REGISTRY_NAMESPACE
    export AWS_REGION

    log_info "Registry configuration loaded."
    log_info "Profile           : ${profile}"
    log_info "Registry Type     : ${REGISTRY_TYPE}"
    log_info "Registry URL      : ${REGISTRY_URL}"
    log_info "Registry Namespace: ${REGISTRY_NAMESPACE}"
}

###############################################################################
# Registry Login
###############################################################################

registry_login() {

    case "${REGISTRY_TYPE}" in

        harbor|dockerhub)

            : "${REGISTRY_USERNAME:?REGISTRY_USERNAME is not set}"
            : "${REGISTRY_PASSWORD:?REGISTRY_PASSWORD is not set}"

            printf '%s' "${REGISTRY_PASSWORD}" |
                docker login \
                    --username "${REGISTRY_USERNAME}" \
                    --password-stdin \
                    "${REGISTRY_URL}"
            ;;

        ecr)

            : "${AWS_REGION:?AWS_REGION is not set}"

            aws ecr get-login-password \
                --region "${AWS_REGION}" |
                docker login \
                    --username AWS \
                    --password-stdin \
                    "${REGISTRY_URL}"
            ;;

        *)

            die "Unsupported registry type: ${REGISTRY_TYPE}"
            ;;

    esac

    log_success "Registry authentication successful."
}

###############################################################################
# Registry Push
###############################################################################

registry_push() {

    local repository="$1"
    local tag="$2"

    local image

    image="${REGISTRY_URL}/${REGISTRY_NAMESPACE}/${repository}:${tag}"

    log_info "Pushing image..."
    log_info "Registry    : ${REGISTRY_URL}"
    log_info "Namespace   : ${REGISTRY_NAMESPACE}"
    log_info "Repository  : ${repository}"
    log_info "Tag         : ${tag}"
    log_info "Image       : ${image}"

    docker push "${image}"
}

###############################################################################
# Registry Logout
###############################################################################

registry_logout() {

    case "${REGISTRY_TYPE:-}" in

        harbor|dockerhub|ecr)

            docker logout "${REGISTRY_URL}" >/dev/null 2>&1 ||
                return 1
            ;;

        *)

            log_warn "Registry logout not implemented for type: ${REGISTRY_TYPE}"
            return 1
            ;;

    esac

    log_success "Registry logout successful."
}
