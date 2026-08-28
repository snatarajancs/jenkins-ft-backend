#!/usr/bin/env bash

###############################################################################
#
# File        : compose.sh
# Description : Docker Compose deployment implementation.
#
# Responsibilities
#   - Validate Compose deployment configuration
#   - Read environment profile
#   - Read built image metadata
#   - Build the exact registry image reference
#   - Execute remote deployment script on application server
#
###############################################################################

set -Eeuo pipefail

###############################################################################
# Public Functions
###############################################################################

deployment_compose() {

    local component="$1"

    local profile
    local profile_file

    local host
    local port

    local app_path
    local compose_file
    local deploy_script

    local registry_url
    local registry_namespace

    local repository
    local tag
    local image_ref

    ###########################################################################
    # Required commands
    ###########################################################################

    require_command ssh
    require_command jq
    require_command yq

    ###########################################################################
    # Jenkins SSH credentials
    ###########################################################################

    : "${DEPLOY_SSH_USER:?DEPLOY_SSH_USER must be supplied by Jenkins}"
    : "${DEPLOY_SSH_KEY:?DEPLOY_SSH_KEY must be supplied by Jenkins}"
    : "${KNOWN_HOSTS_FILE:?KNOWN_HOSTS_FILE must be supplied by Jenkins}"

    ###########################################################################
    # Runtime image metadata
    ###########################################################################

    if ! runtime_has_image "${component}"; then
        die "${component}: No Docker image metadata found."
    fi

    ###########################################################################
    # Resolve active deployment profile
    ###########################################################################

    profile="$(
        json_get \
            "${PIPELINE_CONTEXT_FILE}" \
            ".profile"
    )"

    if [[ -z "${profile}" || "${profile}" == "none" ]]; then
        die "${component}: Deployment profile is not available."
    fi

    profile_file="${JENKINS_DIR}/config/profiles/${profile}.yaml"

    if [[ ! -f "${profile_file}" ]]; then
        die "${component}: Profile file not found: ${profile_file}"
    fi

    ###########################################################################
    # Deployment configuration
    ###########################################################################

    host="$(
        yq -er '.target.host' "${profile_file}"
    )"

    port="$(
        yq -er '.target.port // 22' "${profile_file}"
    )"

    app_path="$(
        yq -er '.application.path' "${profile_file}"
    )"

    compose_file="$(
        yq -er '.application.compose_file' "${profile_file}"
    )"

    deploy_script="$(
        yq -er '.application.deploy_script' "${profile_file}"
    )"

    ###########################################################################
    # Registry configuration
    ###########################################################################

    registry_url="$(
        yq -er '.registry.url' "${profile_file}"
    )"

    registry_namespace="$(
        yq -er '.registry.namespace' "${profile_file}"
    )"

    ###########################################################################
    # Runtime repository + exact tag
    ###########################################################################

    repository="$(
        runtime_get_image "${component}" repository
    )"

    tag="$(
        runtime_get_image "${component}" tag
    )"

    image_ref="${registry_url}/${registry_namespace}/${repository}:${tag}"

    ###########################################################################
    # Display
    ###########################################################################

    log_info "Deploying '${component}'..."
    log_info "Profile    : ${profile}"
    log_info "Host       : ${host}"
    log_info "Port       : ${port}"
    log_info "App Path   : ${app_path}"
    log_info "Compose    : ${compose_file}"
    log_info "Script     : ${deploy_script}"
    log_info "Image      : ${image_ref}"

    ###########################################################################
    # Validate remote deployment files
    ###########################################################################

    log_info "Validating remote deployment files..."

    ssh \
        -i "${DEPLOY_SSH_KEY}" \
        -p "${port}" \
        -o IdentitiesOnly=yes \
        -o "UserKnownHostsFile=${KNOWN_HOSTS_FILE}" \
        -o StrictHostKeyChecking=yes \
        "${DEPLOY_SSH_USER}@${host}" \
        "test -d '${app_path}' && \
         test -f '${app_path}/${compose_file}' && \
         test -x '${app_path}/${deploy_script}'"

    ###########################################################################
    # Deploy
    #
    # App Server deploy.sh handles:
    #   - image pull
    #   - application start
    #   - health verification
    #   - rollback on failure
    ###########################################################################

    ssh \
        -i "${DEPLOY_SSH_KEY}" \
        -p "${port}" \
        -o IdentitiesOnly=yes \
        -o "UserKnownHostsFile=${KNOWN_HOSTS_FILE}" \
        -o StrictHostKeyChecking=yes \
        "${DEPLOY_SSH_USER}@${host}" \
        "cd '${app_path}' && \
        IMAGE='${image_ref}' './${deploy_script}'"

    log_success "${component}: Docker Compose deployment completed."
}