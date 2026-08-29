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
#   - Validate remote deployment requirements
#   - Execute remote deployment script
#   - Report deployment failures clearly
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

    require_file "${DEPLOY_SSH_KEY}"
    require_file "${KNOWN_HOSTS_FILE}"
    require_file "${PIPELINE_CONTEXT_FILE}"

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

    host="$(yq -er '.target.host' "${profile_file}")" \
        || die "${component}: Missing target.host."

    port="$(yq -er '.target.port // 22' "${profile_file}")" \
        || die "${component}: Missing target.port."

    app_path="$(yq -er '.application.path' "${profile_file}")" \
        || die "${component}: Missing application.path."

    compose_file="$(yq -er '.application.compose_file' "${profile_file}")" \
        || die "${component}: Missing application.compose_file."

    deploy_script="$(yq -er '.application.deploy_script' "${profile_file}")" \
        || die "${component}: Missing application.deploy_script."

    ###########################################################################
    # Registry configuration
    ###########################################################################

    registry_url="$(yq -er '.registry.url' "${profile_file}")" \
        || die "${component}: Missing registry.url."

    registry_namespace="$(yq -er '.registry.namespace' "${profile_file}")" \
        || die "${component}: Missing registry.namespace."

    ###########################################################################
    # Runtime repository + exact tag
    ###########################################################################

    repository="$(runtime_get_image "${component}" repository)" \
        || die "${component}: Failed to resolve image repository."

    tag="$(runtime_get_image "${component}" tag)" \
        || die "${component}: Failed to resolve image tag."

    [[ -n "${repository}" ]] \
        || die "${component}: Image repository is empty."

    [[ -n "${tag}" ]] \
        || die "${component}: Image tag is empty."

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
    # SSH configuration
    ###########################################################################

    local ssh_target="${DEPLOY_SSH_USER}@${host}"

    local -a ssh_options=(
        -i "${DEPLOY_SSH_KEY}"
        -p "${port}"
        -o IdentitiesOnly=yes
        -o "UserKnownHostsFile=${KNOWN_HOSTS_FILE}"
        -o StrictHostKeyChecking=yes
        -o ConnectTimeout=10
        -o BatchMode=yes
        -o ServerAliveInterval=30
        -o ServerAliveCountMax=3
    )

    ###########################################################################
    # Validate remote deployment files
    ###########################################################################

    log_info "Validating remote deployment files..."
    log_info "Remote execution identity..."
    ssh "${ssh_options[@]}" \
        "${ssh_target}" \
        "whoami && id"
        
    log_info "Remote deploy script permissions..."
    
    ssh "${ssh_options[@]}" \
        "${ssh_target}" \
        "ls -ld '${app_path}/deploy' && \
         ls -l '${app_path}/${deploy_script}' && \
         test -x '${app_path}/${deploy_script}' && \
         echo 'EXECUTABLE=YES'"
    
    if ! ssh "${ssh_options[@]}" \
        "${ssh_target}" \
        "test -d '${app_path}'"
    then
        die "${component}: Remote application directory not found: ${app_path}"
    fi
    
    if ! ssh "${ssh_options[@]}" \
        "${ssh_target}" \
        "test -f '${app_path}/${compose_file}'"
    then
        die "${component}: Remote Compose file not found: ${app_path}/${compose_file}"
    fi
    
    if ! ssh "${ssh_options[@]}" \
        "${ssh_target}" \
        "test -f '${app_path}/${deploy_script}'"
    then
        die "${component}: Remote deploy script not found: ${app_path}/${deploy_script}"
    fi
    
    if ! ssh "${ssh_options[@]}" \
        "${ssh_target}" \
        "test -x '${app_path}/${deploy_script}'"
    then
        die "${component}: Remote deploy script is not executable: ${app_path}/${deploy_script}"
    fi
    
    log_success "${component}: Remote deployment files validated."

    ###########################################################################
    # Deploy
    #
    # App Server deploy.sh handles:
    #   - image pull
    #   - application start
    #   - health verification
    #   - rollback on failure
    ###########################################################################

    log_info "Executing remote deployment..."

    local remote_command

    printf -v remote_command \
        "cd %q && IMAGE=%q %q" \
        "${app_path}" \
        "${image_ref}" \
        "./${deploy_script}"

    if ! ssh "${ssh_options[@]}" \
        "${ssh_target}" \
        "${remote_command}"
    then
        die "${component}: Remote deployment failed."
    fi

    ###########################################################################
    # Success
    ###########################################################################

    log_success "${component}: Docker Compose deployment completed successfully."
}
