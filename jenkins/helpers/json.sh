#!/usr/bin/env bash

###############################################################################
#
# File        : json.sh
# Description : JSON helper functions library.
#
# Responsibilities
#   - Read required JSON values
#   - Read optional JSON values
#   - Check JSON path existence
#   - Read boolean values
#   - List object keys
#   - List array items
#
###############################################################################

set -Eeuo pipefail

###############################################################################
# Dependencies
###############################################################################

#
# Verify jq is available when common.sh has been loaded.
#
if command -v require_command >/dev/null 2>&1; then
    require_command jq
fi

###############################################################################
# JSON Helpers
###############################################################################

#
# Read a required JSON value.
# Fails if the path does not exist or is null.
#
json_get() {

    local file="$1"
    local path="$2"

    jq -er "${path}" "${file}"
}

#
# Read an optional JSON value.
# Returns an empty string if the path does not exist or is null.
#
json_get_optional() {

    local file="$1"
    local path="$2"

    jq -r "${path} // empty" "${file}"
}

#
# Check whether a JSON path exists.
#
json_exists() {

    local file="$1"
    local path="$2"

    jq -e "${path}" "${file}" >/dev/null 2>&1
}

#
# Return success (0) if the JSON value is boolean true.
#
json_bool() {

    local file="$1"
    local path="$2"

    [[ "$(json_get_optional "${file}" "${path}")" == "true" ]]
}

#
# Return object keys as a line-separated list.
#
json_keys() {

    local file="$1"
    local path="$2"

    jq -r "${path} | keys[]" "${file}"
}

#
# Return array items as a line-separated list.
#
json_array() {

    local file="$1"
    local path="$2"

    jq -r "${path}[]" "${file}"
}