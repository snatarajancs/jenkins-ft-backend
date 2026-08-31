#!/usr/bin/env bash

###############################################################################
#
# File        : compose.sh
# Description : Docker Compose deployment implementation.
#
###############################################################################

set -Eeuo pipefail

###############################################################################
# Public Functions
###############################################################################

deployment_compose() {

    local component="$1"

    ###########################################################################
    # Variables
    ###########################################################################

    local profile
    local profile_file
    local project_config

    local host
    local port

    local app_path
    local compose_file
    local deploy_script

    local registry_url
    local registry_namespace

    local health_check_enabled
    local health_timeout

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
    # Required Jenkins credentials/files
    ###########################################################################

    : "${DEPLOY_SSH_USER:?DEPLOY_SSH_USER must be supplied by Jenkins}"
    : "${DEPLOY_SSH_KEY:?DEPLOY_SSH_KEY must be supplied by Jenkins}"
    : "${KNOWN_HOSTS_FILE:?KNOWN_HOSTS_FILE must be supplied by Jenkins}"

    : "${REGISTRY_USERNAME:?REGISTRY_USERNAME must be supplied by Jenkins}"
    : "${REGISTRY_PASSWORD:?REGISTRY_PASSWORD must be supplied by Jenkins}"

    require_file "${DEPLOY_SSH_KEY}"
    require_file "${KNOWN_HOSTS_FILE}"
    require_file "${PIPELINE_CONTEXT_FILE}"

    ###########################################################################
    # Project configuration
    ###########################################################################

    project_config="${JENKINS_DIR}/config/project.json"

    require_file "${project_config}"

    ###########################################################################
    # Resolve deployment profile
    ###########################################################################

    profile="$(
        json_get \
            "${PIPELINE_CONTEXT_FILE}" \
            ".profile"
    )" || die "${component}: Failed to extract deployment profile."

    if [[ -z "${profile}" ||
          "${profile}" == "none" ||
          "${profile}" == "null" ]]; then

        die "${component}: Deployment profile is not available."
    fi

    profile_file="${JENKINS_DIR}/config/profiles/${profile}.yaml"

    require_file "${profile_file}"

    ###########################################################################
    # Resolve deployment configuration
    ###########################################################################

    host="$(
        yq -er '.target.host' \
            "${profile_file}"
    )" || die "${component}: Missing target.host."

    port="$(
        yq -er '.target.port // 22' \
            "${profile_file}"
    )" || die "${component}: Invalid target.port."

    app_path="$(
        yq -er '.application.path' \
            "${profile_file}"
    )" || die "${component}: Missing application.path."

    compose_file="$(
        yq -er '.application.compose_file' \
            "${profile_file}"
    )" || die "${component}: Missing application.compose_file."

    deploy_script="$(
        yq -er '.application.deploy_script' \
            "${profile_file}"
    )" || die "${component}: Missing application.deploy_script."

    ###########################################################################
    # Resolve registry configuration
    ###########################################################################

    registry_url="$(
        yq -er '.registry.url' \
            "${profile_file}"
    )" || die "${component}: Missing registry.url."

    registry_namespace="$(
        yq -er '.registry.namespace' \
            "${profile_file}"
    )" || die "${component}: Missing registry.namespace."

    ###########################################################################
    # Resolve health-check defaults from project.json
    ###########################################################################

    health_check_enabled="$(
        jq -er \
            ".components.${component}.health_check.enabled // true" \
            "${project_config}"
    )" || die "${component}: Invalid project health_check.enabled."

    health_timeout="$(
        jq -er \
            ".components.${component}.health_check.timeout // 180" \
            "${project_config}"
    )" || die "${component}: Invalid project health_check.timeout."

    ###########################################################################
    # Apply environment-specific overrides
    ###########################################################################

    if yq -e '.health_check.enabled != null' \
        "${profile_file}" >/dev/null 2>&1
    then

        health_check_enabled="$(
            yq -er '.health_check.enabled' \
                "${profile_file}"
        )" || die "${component}: Invalid profile health_check.enabled."

    fi

    if yq -e '.health_check.timeout != null' \
        "${profile_file}" >/dev/null 2>&1
    then

        health_timeout="$(
            yq -er '.health_check.timeout' \
                "${profile_file}"
        )" || die "${component}: Invalid profile health_check.timeout."

    fi

    ###########################################################################
    # Validate health-check values
    ###########################################################################

    case "${health_check_enabled}" in
        true|false)
            ;;
        *)
            die "${component}: health_check.enabled must be true or false."
            ;;
    esac

    [[ "${health_timeout}" =~ ^[0-9]+$ ]] &&
        (( health_timeout > 0 )) ||
        die "${component}: health_check.timeout must be a positive integer."

    ###########################################################################
    # Resolve runtime Docker image
    ###########################################################################

    if ! runtime_has_image "${component}"; then
        die "${component}: No Docker image metadata found."
    fi

    repository="$(
        runtime_get_image \
            "${component}" \
            repository
    )" || die "${component}: Failed to resolve image repository."

    tag="$(
        runtime_get_image \
            "${component}" \
            tag
    )" || die "${component}: Failed to resolve image tag."

    [[ -n "${repository}" ]] ||
        die "${component}: Image repository is empty."

    [[ -n "${tag}" ]] ||
        die "${component}: Image tag is empty."

    ###########################################################################
    # Build exact Docker image reference
    ###########################################################################

    image_ref="${registry_url}/${registry_namespace}/${repository}:${tag}"

    ###########################################################################
    # Deployment information
    ###########################################################################

    log_info "Deploying '${component}'..."
    log_info "Profile            : ${profile}"
    log_info "Host               : ${host}"
    log_info "Port               : ${port}"
    log_info "App Path           : ${app_path}"
    log_info "Compose            : ${compose_file}"
    log_info "Deploy Script      : ${deploy_script}"
    log_info "Image              : ${image_ref}"
    log_info "Health Check       : ${health_check_enabled}"
    log_info "Health Timeout     : ${health_timeout}s"

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

    local validation_command

    printf -v validation_command \
        'test -d %q &&
         test -f %q &&
         test -x %q' \
        "${app_path}" \
        "${app_path}/${compose_file}" \
        "${app_path}/${deploy_script}"

    if ! ssh "${ssh_options[@]}" \
        "${ssh_target}" \
        "${validation_command}"
    then

        die "${component}: Remote deployment validation failed."

    fi

    log_success \
        "${component}: Remote deployment files validated."

    ###########################################################################
    # Execute remote deployment
    ###########################################################################

    log_info "Executing remote deployment..."

    local remote_command

    printf -v remote_command \
        "cd %q && IMAGE=%q REGISTRY_URL=%q HEALTH_CHECK_ENABLED=%q HEALTH_TIMEOUT=%q ./%q" \
        "${app_path}" \
        "${image_ref}" \
        "${registry_url}" \
        "${health_check_enabled}" \
        "${health_timeout}" \
        "${deploy_script}"

    if ! {
        printf '%s\n' "${REGISTRY_USERNAME}"
        printf '%s\n' "${REGISTRY_PASSWORD}"
    } | ssh "${ssh_options[@]}" \
            "${ssh_target}" \
            "${remote_command}"
    then

        die "${component}: Remote deployment failed."

    fi

    ###########################################################################
    # Success
    ###########################################################################

    log_success \
        "${component}: Docker Compose deployment completed successfully."
}