#!/usr/bin/env bash

###############################################################################
#
# File        : 09-run-e2e-tests.sh
# Description : Run configured end-to-end test suites.
#
# Responsibilities
#   - Execute configured E2E test scripts
#   - Honor Jenkins RUN_E2E_TESTS parameter
#   - Run E2E tests only for changed components when change data is available
#   - Skip components without E2E configuration
#
###############################################################################

set -Eeuo pipefail

###############################################################################
# Paths
###############################################################################

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
JENKINS_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

###############################################################################
# Load Libraries
###############################################################################

source "${JENKINS_DIR}/common.sh"
source "${JENKINS_DIR}/helpers/json.sh"
source "${JENKINS_DIR}/helpers/runtime.sh"
source "${JENKINS_DIR}/helpers/component.sh"

###############################################################################
# Validation
###############################################################################

require_file "${PROJECT_FILE}"

log_header "Run E2E Tests"

###############################################################################
# Pipeline Parameter
###############################################################################

RUN_E2E_TESTS="${RUN_E2E_TESTS:-false}"

log_info "RUN_E2E_TESTS=${RUN_E2E_TESTS}"

if [[ "${RUN_E2E_TESTS}" != "true" ]]; then
    log_info "E2E tests disabled by pipeline parameter."
    log_info "Skipping E2E tests."
    log_success "E2E test stage skipped successfully."
    exit 0
fi

log_info "Executing configured E2E tests..."

###############################################################################
# Determine Components
###############################################################################

components=()

if [[ -f "${SOURCE_CHANGES_FILE}" ]] &&
   json_exists "${SOURCE_CHANGES_FILE}" ".changed_components"; then

    mapfile -t components < <(
        json_array "${SOURCE_CHANGES_FILE}" ".changed_components"
    )

    log_info "Using incremental build components."

else

    log_info "Source change information unavailable."
    log_info "Using all configured application components."

    mapfile -t components < <(
        json_keys "${PROJECT_FILE}" ".components"
    )
fi

###############################################################################
# No Components
###############################################################################

if [[ "${#components[@]}" -eq 0 ]]; then
    log_info "No application components selected for E2E testing."
    log_success "E2E test stage completed successfully."
    exit 0
fi

###############################################################################
# Execute E2E Tests
###############################################################################

e2e_executed=false

for component in "${components[@]}"; do

    log_info "Checking E2E configuration: ${component}"

    source_dir="$(json_get_optional \
        "${PROJECT_FILE}" \
        ".components.${component}.source"
    )"

    if [[ -z "${source_dir}" || "${source_dir}" == "null" ]]; then
        log_warn "${component}: source directory not configured. Skipping."
        continue
    fi

    e2e_path=".components.${component}.testing.e2e"

    if ! json_exists "${PROJECT_FILE}" "${e2e_path}"; then
        log_info "${component}: E2E configuration not found. Skipping."
        continue
    fi

    if ! json_bool "${PROJECT_FILE}" "${e2e_path}.enabled"; then
        log_info "${component}: E2E tests disabled in project configuration."
        continue
    fi

    script="$(json_get_optional \
        "${PROJECT_FILE}" \
        "${e2e_path}.script"
    )"

    if [[ -z "${script}" || "${script}" == "null" ]]; then
        log_error "${component}: E2E script is not configured."
        exit 1
    fi

    source_dir="${WORKSPACE:-${PWD}}/${source_dir}"

    if [[ ! -d "${source_dir}" ]]; then
        log_error "${component}: Source directory not found: ${source_dir}"
        exit 1
    fi

    log_info "Component       : ${component}"
    log_info "Source directory: ${source_dir}"
    log_info "E2E command     : ${script}"

    (
        cd "${source_dir}"

        log_info "${component}: Running E2E tests..."

        bash -c "${script}"
    )

    log_success "${component}: E2E tests passed."

    e2e_executed=true

done

###############################################################################
# Result
###############################################################################

if [[ "${e2e_executed}" == "false" ]]; then
    log_info "No configured E2E test suites were executed."
else
    log_success "All configured E2E tests passed."
fi

log_success "E2E test stage completed successfully."