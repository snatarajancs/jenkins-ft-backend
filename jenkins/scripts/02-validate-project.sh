#!/usr/bin/env bash

###############################################################################
#
# File        : 02-validate-project.sh
# Description : Validate project configuration.
#
# Responsibilities
#   - Validate project configuration schema
#   - Validate business rules
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

# shellcheck disable=SC1091
source "${JENKINS_DIR}/common.sh"

# shellcheck disable=SC1091
source "${JENKINS_DIR}/helpers/json.sh"

# shellcheck disable=SC1091
source "${JENKINS_DIR}/helpers/validate-schema.sh"

# shellcheck disable=SC1091
source "${JENKINS_DIR}/helpers/validate-business-rules.sh"

###############################################################################
# Configuration
###############################################################################

readonly PROJECT_SCHEMA_FILE="${JENKINS_DIR}/config/project.schema.json"
readonly PROJECT_CONFIG_FILE="${JENKINS_DIR}/config/project.json"

###############################################################################
# Main
###############################################################################

main() {

    log_header "Project Validation"

    validate_schema \
        "${PROJECT_SCHEMA_FILE}" \
        "${PROJECT_CONFIG_FILE}"

    validate_business_rules

    log_success "Project validation completed successfully."
}

main "$@"