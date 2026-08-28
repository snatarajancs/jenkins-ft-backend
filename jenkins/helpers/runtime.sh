#!/usr/bin/env bash

###############################################################################
#
# File        : runtime.sh
# Description : Pipeline runtime helper library.
#
# Responsibilities
#   - Initialize runtime files
#   - Return Docker image tag
#   - Store Docker image metadata
#   - Validate Docker image metadata
#   - Read Docker image metadata
#
###############################################################################

set -Eeuo pipefail

###############################################################################
# Source Guard
###############################################################################

if [[ -n "${RUNTIME_SH_LOADED:-}" ]]; then
    return 0
fi

readonly RUNTIME_SH_LOADED=1

###############################################################################
# Paths
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JENKINS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${JENKINS_DIR}/runtime"

###############################################################################
# Load Libraries
###############################################################################

# shellcheck disable=SC1091
source "${JENKINS_DIR}/helpers/json.sh"

###############################################################################
# Configuration
###############################################################################

readonly PIPELINE_CONTEXT_FILE="${RUNTIME_DIR}/pipeline-context.json"
readonly SOURCE_CHANGES_FILE="${RUNTIME_DIR}/source-changes.json"
readonly IMAGE_METADATA_FILE="${RUNTIME_DIR}/docker-images.json"

###############################################################################
# Public Functions
###############################################################################

#
# Initialize runtime directory and files.
#
runtime_init() {

    mkdir -p "${RUNTIME_DIR}"

    printf '{}' > "${PIPELINE_CONTEXT_FILE}"
    printf '{"components":{}}' > "${SOURCE_CHANGES_FILE}"
    printf '{}' > "${IMAGE_METADATA_FILE}"
}

#
# Return the current Docker image tag.
#
runtime_get_image_tag() {

    local image_tag

    image_tag="$(
        json_get_optional \
            "${PIPELINE_CONTEXT_FILE}" \
            ".commit"
    )"

    if [[ -z "${image_tag}" || "${image_tag}" == "unknown" ]]; then

        image_tag="$(
            json_get \
                "${PIPELINE_CONTEXT_FILE}" \
                ".build_number"
        )"

    fi

    printf '%s\n' "${image_tag}"
}

#
# Store Docker image metadata.
#
# Usage:
#   runtime_set_image <component> <repository> <tag> <image_id>
#
runtime_set_image() {

    local component="$1"
    local repository="$2"
    local tag="$3"
    local image_id="$4"

    jq \
        --arg component "${component}" \
        --arg repository "${repository}" \
        --arg tag "${tag}" \
        --arg image_id "${image_id}" \
        '
        .[$component] = {
            repository: $repository,
            tag: $tag,
            image_id: $image_id
        }
        ' \
        "${IMAGE_METADATA_FILE}" \
        > "${IMAGE_METADATA_FILE}.tmp"

    mv \
        "${IMAGE_METADATA_FILE}.tmp" \
        "${IMAGE_METADATA_FILE}"
}

#
# Check whether Docker image metadata exists.
#
# Usage:
#   runtime_has_image <component>
#
runtime_has_image() {

    local component="$1"

    json_exists \
        "${IMAGE_METADATA_FILE}" \
        ".${component}"
}

#
# Return a Docker image metadata field.
#
# Usage:
#   runtime_get_image <component> <field>
#
runtime_get_image() {

    local component="$1"
    local field="$2"

    json_get \
        "${IMAGE_METADATA_FILE}" \
        ".${component}.${field}"
}