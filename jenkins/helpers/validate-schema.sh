#!/usr/bin/env bash

###############################################################################
#
# File        : validate-schema.sh
# Description : JSON Schema validation library.
#
# Responsibilities
#   - Validate a JSON file against a JSON Schema
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

###############################################################################
# Public Functions
###############################################################################

#
# Validate a JSON file against a JSON Schema.
#
# Usage:
#   validate_schema <schema_file> <json_file>
#
validate_schema() {

    local schema_file="$1"
    local json_file="$2"

    [[ $# -eq 2 ]] || die "Usage: validate_schema <schema_file> <json_file>"

    log_info "Validating JSON configuration against schema..."

    require_command ajv

    require_file "${schema_file}"
    require_file "${json_file}"

    log_info "Schema : ${schema_file}"
    log_info "JSON   : ${json_file}"

    if ! ajv validate \
        --spec=draft2020 \
        --strict=true \
        -s "${schema_file}" \
        -d "${json_file}"
    then
        die "Schema validation failed."
    fi

    log_success "Schema validation passed."
}