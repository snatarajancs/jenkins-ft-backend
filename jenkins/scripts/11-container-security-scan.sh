#!/usr/bin/env bash

###############################################################################
#
# File        : 11-container-security-scan.sh
# Description : Scan locally built Docker images using Trivy container.
#
# Responsibilities
#   - Read registry configuration from environment profile
#   - Read built image metadata from runtime/docker-images.json
#   - Reconstruct the exact image built by script 10
#   - Run Trivy inside a Docker container
#   - Generate SARIF and console reports
#
###############################################################################

set -Eeuo pipefail

###############################################################################
# Paths
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JENKINS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

readonly REPORT_DIR="${JENKINS_DIR}/reports/trivy"
readonly TRIVY_CACHE_DIR="${JENKINS_DIR}/runtime/.trivy-cache"

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
# Configuration
###############################################################################

readonly TRIVY_IMAGE="${TRIVY_IMAGE:-aquasec/trivy:0.64.1}"
readonly TRIVY_SEVERITY="${TRIVY_SEVERITY:-HIGH,CRITICAL}"

readonly TRIVY_GROUP_ID="$(
    stat -c '%g' /var/run/docker.sock 2>/dev/null || echo 0
)"

###############################################################################
# Scan Images
###############################################################################

scan_images() {

    local components
    local component
    local repository
    local tag
    local image

    local sarif_report
    local table_report

    ###########################################################################
    # Load registry configuration from environment profile
    ###########################################################################

    registry_load_profile

    ###########################################################################
    # Validate registry configuration
    ###########################################################################

    if [[ -z "${REGISTRY_URL:-}" ]]; then
        die "Registry URL is empty."
    fi

    if [[ -z "${REGISTRY_NAMESPACE:-}" ]]; then
        die "Registry namespace is empty."
    fi

    ###########################################################################
    # Verify Docker image metadata
    ###########################################################################

    if [[ ! -s "${IMAGE_METADATA_FILE}" ]]; then
        die "Docker image metadata not found: ${IMAGE_METADATA_FILE}"
    fi

    ###########################################################################
    # Get built components
    #
    # docker-images.json structure:
    #
    # {
    #   "backend": {
    #       "repository": "backend",
    #       "tag": "dev-33879b4",
    #       "image_id": "sha256:..."
    #   }
    # }
    #
    ###########################################################################

    components="$(
        jq -r 'keys[]' \
            "${IMAGE_METADATA_FILE}"
    )"

    if [[ -z "${components}" ]]; then
        die "No Docker images found in ${IMAGE_METADATA_FILE}."
    fi

    ###########################################################################
    # Prepare report and cache directories
    ###########################################################################

    mkdir -p "${REPORT_DIR}"
    mkdir -p "${TRIVY_CACHE_DIR}"

    ###########################################################################
    # Scan each image
    ###########################################################################

    while read -r component
    do

        [[ -n "${component}" ]] || continue

        #######################################################################
        # Read image metadata
        #######################################################################

        repository="$(
            runtime_get_image \
                "${component}" \
                repository
        )"

        tag="$(
            runtime_get_image \
                "${component}" \
                tag
        )"

        if [[ -z "${repository}" || -z "${tag}" ]]; then
            die "${component}: Docker image metadata is incomplete."
        fi

        #######################################################################
        # Reconstruct exact image reference
        #######################################################################

        image="${REGISTRY_URL}/${REGISTRY_NAMESPACE}/${repository}:${tag}"

        sarif_report="${REPORT_DIR}/${component}.sarif"
        table_report="${REPORT_DIR}/${component}.txt"

        #######################################################################
        # Display scan information
        #######################################################################

        log_info "Scanning Docker image..."
        log_info "Component       : ${component}"
        log_info "Registry Type   : ${REGISTRY_TYPE}"
        log_info "Registry        : ${REGISTRY_URL}"
        log_info "Namespace       : ${REGISTRY_NAMESPACE}"
        log_info "Repository      : ${repository}"
        log_info "Image Tag       : ${tag}"
        log_info "Image           : ${image}"
        log_info "Trivy Image     : ${TRIVY_IMAGE}"
        log_info "Severity        : ${TRIVY_SEVERITY}"
        log_info "Policy          : Informational (Build Not Blocked)"

        #######################################################################
        # Verify local Docker image
        #######################################################################

        if ! docker image inspect "${image}" >/dev/null 2>&1; then
            die "${component}: Docker image not found locally: ${image}"
        fi

        log_success "${component}: Local Docker image verified."

        #######################################################################
        # Trivy version
        #######################################################################

        log_info "Trivy Version"

        docker run --rm \
            --entrypoint "" \
            "${TRIVY_IMAGE}" \
            trivy --version

        #######################################################################
        # SARIF report
        #######################################################################

        log_info "Generating SARIF security report..."

        docker run --rm \
            --entrypoint "" \
            --group-add "${TRIVY_GROUP_ID}" \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -v "${TRIVY_CACHE_DIR}:/root/.cache/" \
            -v "${REPORT_DIR}:/reports" \
            "${TRIVY_IMAGE}" \
            trivy image \
                --skip-version-check \
                --no-progress \
                --scanners vuln \
                --severity "${TRIVY_SEVERITY}" \
                --ignore-unfixed \
                --format sarif \
                --output "/reports/${component}.sarif" \
                --exit-code 0 \
                "${image}"

        #######################################################################
        # Console scan
        #######################################################################

        log_info "Running vulnerability scan..."

        docker run --rm \
            --entrypoint "" \
            --group-add "${TRIVY_GROUP_ID}" \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -v "${TRIVY_CACHE_DIR}:/root/.cache/" \
            "${TRIVY_IMAGE}" \
            trivy image \
                --no-progress \
                --scanners vuln \
                --severity "${TRIVY_SEVERITY}" \
                --ignore-unfixed \
                --exit-code 0 \
                --format table \
                "${image}" \
            | tee "${table_report}"

        #######################################################################
        # Verify reports
        #######################################################################

        if [[ ! -s "${sarif_report}" ]]; then
            die "${component}: SARIF report was not generated."
        fi

        if [[ ! -s "${table_report}" ]]; then
            die "${component}: Table report was not generated."
        fi

        #######################################################################
        # Report information
        #######################################################################

        log_info "SARIF Report    : ${sarif_report}"
        log_info "Table Report    : ${table_report}"

        log_success "${component}: Security scan completed."

    done <<< "${components}"
}

###############################################################################
# Main
###############################################################################

main() {

    log_header "Container Security Scan"

    require_command docker
    require_command jq

    if [[ ! -S /var/run/docker.sock ]]; then
        die "Docker socket not available: /var/run/docker.sock"
    fi

    scan_images

    log_success "Container security scan completed successfully."
}

###############################################################################
# Entry Point
###############################################################################

main "$@"