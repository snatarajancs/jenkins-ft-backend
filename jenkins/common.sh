#!/usr/bin/env bash

###############################################################################
#
# File        : common.sh
# Description : Shared utility library for Jenkins pipeline scripts.
#
# Responsibilities
#   - Logging
#   - Error handling
#   - Validation helpers
#   - Path helpers
#
# Must NOT contain
#   - Build logic
#   - Deployment logic
#   - Docker logic
#   - AWS logic
#   - Project specific logic
#

###############################################################################
# Configuration
###############################################################################

readonly PROJECT_FILE="${JENKINS_DIR}/config/project.json"

###############################################################################
# Exit Codes
###############################################################################

readonly EXIT_SUCCESS=0
readonly EXIT_ERROR=1
readonly EXIT_COMMAND_NOT_FOUND=2
readonly EXIT_FILE_NOT_FOUND=3
readonly EXIT_DIRECTORY_NOT_FOUND=4
readonly EXIT_INVALID_JSON=5

###############################################################################
# Internal
###############################################################################

_timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

###############################################################################
# Logging
###############################################################################

log_info() {
    printf '%s [INFO] %s\n' "$(_timestamp)" "$*"
}

log_warn() {
    printf '%s [WARN] %s\n' "$(_timestamp)" "$*"
}

log_error() {
    printf '%s [ERROR] %s\n' "$(_timestamp)" "$*" >&2
}

log_success() {
    printf '%s [SUCCESS] %s\n' "$(_timestamp)" "$*"
}

###############################################################################
# Banner
###############################################################################

log_header() {

    printf '\n'
    printf '============================================================\n'
    printf '%s\n' "$*"
    printf '============================================================\n'
    printf '\n'

}

###############################################################################
# Error Handling
###############################################################################

die() {

    local message="${1:-Unknown error}"
    local exit_code="${2:-${EXIT_ERROR}}"

    log_error "${message}"

    exit "${exit_code}"
}


###############################################################################
# Validation Helpers
###############################################################################

require_command() {

    local cmd="$1"

    command -v "${cmd}" >/dev/null 2>&1 \
        || die "Required command not found: ${cmd}" \
        "${EXIT_COMMAND_NOT_FOUND}"

}

require_file() {

    local file="$1"

    [[ -f "${file}" ]] \
        || die "Required file not found: ${file}" \
        "${EXIT_FILE_NOT_FOUND}"

}

require_directory() {

    local dir="$1"

    [[ -d "${dir}" ]] \
        || die "Required directory not found: ${dir}" \
        "${EXIT_DIRECTORY_NOT_FOUND}"

}

require_json() {

    local file="$1"

    require_file "${file}"

    jq empty "${file}" >/dev/null 2>&1 \
        || die "Invalid JSON file: ${file}" \
        "${EXIT_INVALID_JSON}"

}

###############################################################################
# Path Helpers
###############################################################################

get_script_dir() {

    local source_file="$1"

    cd "$(dirname "${source_file}")" >/dev/null 2>&1 && pwd

}

get_jenkins_dir() {

    local script_dir="$1"

    dirname "${script_dir}"

}

get_project_root() {

    if git rev-parse --show-toplevel >/dev/null 2>&1; then
        git rev-parse --show-toplevel
    else
        printf '%s\n' "${WORKSPACE:-$(pwd)}"
    fi

}