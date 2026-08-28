#!/usr/bin/env bash

###############################################################################
#
# File        : 12-deploy.sh
# Description : Deploy project components.
#
# Responsibilities
#   - Deploy project components based on configuration
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
source "${JENKINS_DIR}/helpers/component.sh"

# shellcheck disable=SC1091
source "${JENKINS_DIR}/helpers/deployment.sh"

###############################################################################
# Public Functions
###############################################################################

deploy_component() {

    local component="$1"

    deployment_execute "${component}"
}

###############################################################################
# Main
###############################################################################

main() {

    log_header "Deploy Application"

    for_each_component deploy_component

    log_success "Deployment completed."

}

main "$@"