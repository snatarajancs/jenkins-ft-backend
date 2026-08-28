#!/usr/bin/env bash

###############################################################################
#
# File        : 01-initialize-environment.sh
# Description : Initialize Jenkins pipeline environment.
#
# Responsibilities
#   - Validate required commands
#   - Initialize pipeline runtime
#   - Print environment summary
#
###############################################################################

set -Eeuo pipefail

###############################################################################
# Paths
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JENKINS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Fallback gracefully if not in a git tree
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || printf '%s' "${WORKSPACE:-$(pwd)}")"

###############################################################################
# Load Libraries
###############################################################################

# shellcheck disable=SC1091
source "${JENKINS_DIR}/common.sh"

# shellcheck disable=SC1091
source "${JENKINS_DIR}/helpers/runtime.sh"

###############################################################################
# Main
###############################################################################

main() {
    log_header "Initialize Environment"

    #
    # Required commands (External dependencies only)
    #
    require_command bash
    require_command git
    require_command jq

    #
    # Initialize runtime directory and state files.
    #
    runtime_init

    #
    # Environment summary
    #
    log_info "Project Root : ${PROJECT_ROOT}"
    log_info "Jenkins Dir  : ${JENKINS_DIR}"
    log_info "Scripts Dir  : ${SCRIPT_DIR}"

    log_success "Environment initialized successfully."
}

main "$@"