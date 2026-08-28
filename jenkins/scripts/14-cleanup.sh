#!/usr/bin/env bash

###############################################################################
#
# File        : 14-cleanup.sh
# Description : Cleanup pipeline runtime resources.
#
# Responsibilities
#   - Remove runtime files
#   - Remove temporary files
#   - Logout from container registry
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

###############################################################################
# Configuration
###############################################################################

readonly RUNTIME_DIR="${JENKINS_DIR}/runtime"

###############################################################################
# Public Functions
###############################################################################

cleanup_runtime() {

    if [[ -d "${RUNTIME_DIR}" ]]; then

        rm -rf "${RUNTIME_DIR:?}/"*

    fi
}

###############################################################################
# Main
###############################################################################

main() {

    log_header "Cleanup"

    #
    # Remove runtime files.
    #
    cleanup_runtime

    log_success "Cleanup completed."

}

main "$@"
