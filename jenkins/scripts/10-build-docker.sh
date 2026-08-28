#!/usr/bin/env bash
###############################################################################
#
# File        : 10-build-docker.sh
# Description : Build Docker images for configured container components.
#
# Responsibilities
#   - Read environment from pipeline-context.json
#   - Read registry configuration from environment profile
#   - Generate immutable environment-aware image tags
#   - Build Docker images
#   - Verify built images
#   - Store image metadata for later pipeline stages
#
# Image format:
#   ${REGISTRY_URL}/${REGISTRY_NAMESPACE}/${REPOSITORY}:${ENVIRONMENT}-${GIT_SHA}
#
# Example:
#   registry.company.com/jenkins-pipeline-poc-github-app/backend:stage-8f31a42
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

# shellcheck disable=SC1091
source "${JENKINS_DIR}/helpers/component.sh"

# shellcheck disable=SC1091
source "${JENKINS_DIR}/helpers/runtime.sh"

# shellcheck disable=SC1091
source "${JENKINS_DIR}/helpers/registry.sh"

###############################################################################
# Configuration
###############################################################################

readonly CONTEXT_FILE="${JENKINS_DIR}/runtime/pipeline-context.json"

###############################################################################
# Build Component Image
###############################################################################

build_component_image() {

    local component="$1"

    ###########################################################################
    # Skip components without container configuration
    ###########################################################################

    if ! json_exists \
        "${PROJECT_FILE}" \
        ".components.${component}.container"; then

        log_info "${component}: No container configuration. Skipping."

        return 0
    fi

    ###########################################################################
    # Read component configuration
    ###########################################################################

    local source
    local repository
    local dockerfile
    local context

    source="$(
        json_get \
            "${PROJECT_FILE}" \
            ".components.${component}.source"
    )"

    repository="$(
        json_get \
            "${PROJECT_FILE}" \
            ".components.${component}.container.repository"
    )"

    dockerfile="$(
        json_get_optional \
            "${PROJECT_FILE}" \
            ".components.${component}.container.dockerfile"
    )"

    context="$(
        json_get_optional \
            "${PROJECT_FILE}" \
            ".components.${component}.container.context"
    )"

    dockerfile="${dockerfile:-Dockerfile}"
    context="${context:-.}"

    ###########################################################################
    # Read build environment from pipeline context
    ###########################################################################

    local environment

    environment="$(
        json_get \
            "${CONTEXT_FILE}" \
            ".environment"
    )"

    if [[ -z "${environment}" || "${environment}" == "null" ]]; then
        die "${component}: Environment is missing from ${CONTEXT_FILE}."
    fi

    ###########################################################################
    # Validate environment
    ###########################################################################

    case "${environment}" in
        dev|stage|prod|feature)
            ;;
        *)
            die "${component}: Invalid environment '${environment}'."
            ;;
    esac

    ###########################################################################
    # Load registry configuration from environment profile
    #
    # Example:
    #
    # staging.yaml
    #   registry:
    #     type: harbor
    #     url: registry.company.com
    #     namespace: jenkins-pipeline-poc-github-app
    #
    # This replaces the old Jenkins DOCKER_REGISTRY dependency.
    ###########################################################################

    registry_load_profile

    ###########################################################################
    # Validate registry configuration
    ###########################################################################

    if [[ -z "${REGISTRY_URL:-}" ]]; then
        die "${component}: Registry URL is empty."
    fi

    if [[ -z "${REGISTRY_NAMESPACE:-}" ]]; then
        die "${component}: Registry namespace is empty."
    fi

    ###########################################################################
    # Git commit
    #
    # Jenkins provides GIT_COMMIT.
    # git rev-parse is a safe fallback for local/script testing.
    ###########################################################################

    local git_sha="${GIT_COMMIT:-}"

    if [[ -z "${git_sha}" || "${git_sha}" == "null" ]]; then
        git_sha="$(git -C "${PROJECT_ROOT}" rev-parse HEAD)"
    fi

    git_sha="${git_sha:0:7}"

    if [[ ! "${git_sha}" =~ ^[[:xdigit:]]{7}$ ]]; then
        die "${component}: Invalid Git commit SHA '${git_sha}'."
    fi

    ###########################################################################
    # Generate immutable image tag
    ###########################################################################

    local image_tag="${environment}-${git_sha}"

    ###########################################################################
    # Full registry-qualified image
    ###########################################################################

    local image="${REGISTRY_URL}/${REGISTRY_NAMESPACE}/${repository}:${image_tag}"

    ###########################################################################
    # Build paths
    ###########################################################################

    local source_dir="${PROJECT_ROOT}/${source}"

    require_command docker
    require_command git
    require_command jq

    require_directory "${source_dir}"

    pushd "${source_dir}" >/dev/null

    require_file "${dockerfile}"
    require_directory "${context}"

    ###########################################################################
    # Build information
    ###########################################################################

    log_info "Building Docker image..."
    log_info "Component       : ${component}"
    log_info "Environment     : ${environment}"
    log_info "Registry Type   : ${REGISTRY_TYPE}"
    log_info "Registry        : ${REGISTRY_URL}"
    log_info "Namespace       : ${REGISTRY_NAMESPACE}"
    log_info "Repository      : ${repository}"
    log_info "Git Commit      : ${git_sha}"
    log_info "Image Tag       : ${image_tag}"
    log_info "Dockerfile      : ${dockerfile}"
    log_info "Context         : ${context}"
    log_info "Image           : ${image}"

    ###########################################################################
    # Docker daemon validation
    ###########################################################################

    if ! docker version >/dev/null 2>&1; then
        popd >/dev/null

        die "${component}: Unable to communicate with Docker daemon."
    fi

    ###########################################################################
    # Build image
    ###########################################################################

    docker build \
        --tag "${image}" \
        --file "${dockerfile}" \
        "${context}"

    ###########################################################################
    # Verify image
    ###########################################################################

    local image_id

    image_id="$(
        docker image inspect \
            --format '{{.Id}}' \
            "${image}"
    )"

    if [[ -z "${image_id}" ]]; then
        popd >/dev/null

        die "${component}: Docker image verification failed."
    fi

    ###########################################################################
    # Store metadata
    #
    # Repository and tag remain separate because runtime.sh stores and
    # downstream scripts consume these values.
    #
    # registry.sh will resolve the registry again during push.
    ###########################################################################

    runtime_set_image \
        "${component}" \
        "${repository}" \
        "${image_tag}" \
        "${image_id}"

    ###########################################################################
    # Success output
    ###########################################################################

    log_success "${component}: Docker image built successfully."
    log_success "${component}: Image: ${image}"
    log_info "${component}: Image ID: ${image_id}"

    popd >/dev/null
}

###############################################################################
# Main
###############################################################################

main() {

    log_header "Build Docker Images"

    require_file "${PROJECT_FILE}"
    require_file "${CONTEXT_FILE}"

    # IMPORTANT:
    # Do NOT call runtime_init here.
    #
    # 03-detect-build-context.sh already created pipeline-context.json.
    # 04-detect-source-changes.sh already created source-changes.json.
    #
    # runtime_init() would reset those runtime files.

    for_each_component build_component_image

    log_success "Docker image build completed successfully."
}

###############################################################################
# Entry Point
###############################################################################

main "$@"