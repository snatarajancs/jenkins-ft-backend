#!/usr/bin/env bash

###############################################################################
#
# File        : validate-business-rules.sh
# Description : Validate project business rules.
#
# Responsibilities
#   - Validate build tool compatibility
#   - Validate deployment requirements
#   - Validate testing requirements
#   - Validate dependency references
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
source "${JENKINS_DIR}/helpers/json.sh"

###############################################################################
# Internal Helpers
###############################################################################

effective_deployment_target() {

    local component="$1"
    local target

    target="$(
        json_get_optional \
            "${PROJECT_FILE}" \
            ".components.${component}.deployment.target"
    )"

    if [[ -z "${target}" ]]; then
        target="$(
            json_get_optional \
                "${PROJECT_FILE}" \
                ".deployment.target"
        )"
    fi

    printf '%s\n' "${target:-none}"
}

validate_build_tool_rules() {

    local component="$1"
    local language
    local build_tool

    language="$(
        json_get \
            "${PROJECT_FILE}" \
            ".components.${component}.language"
    )"

    build_tool="$(
        json_get_optional \
            "${PROJECT_FILE}" \
            ".components.${component}.build.tool"
    )"

    #
    # If no build tool is configured, do not force one here.
    #
    [[ -z "${build_tool}" ]] && return 0

    case "${language}" in

        go)
            [[ "${build_tool}" == "go" ]] \
                || die "${component}: Go projects must use build tool 'go'."
            ;;

        nodejs)
            case "${build_tool}" in
                npm|pnpm|yarn|bun) ;;
                *)
                    die "${component}: Node.js projects must use a valid Node build tool."
                    ;;
            esac
            ;;

        python)
            case "${build_tool}" in
                pip|poetry) ;;
                *)
                    die "${component}: Python projects must use build tool 'pip' or 'poetry'."
                    ;;
            esac
            ;;

        java)
            case "${build_tool}" in
                maven|gradle) ;;
                *)
                    die "${component}: Java projects must use build tool 'maven' or 'gradle'."
                    ;;
            esac
            ;;

        static)
            die "${component}: Static projects must not define a build tool."
            ;;

        *)
            #
            # Other languages are intentionally not forced in V1.
            #
            ;;
    esac
}

validate_deployment_rules() {

    local component="$1"
    local target

    target="$(effective_deployment_target "${component}")"

    case "${target}" in

        none)
            return 0
            ;;

        compose|ecs)
            json_exists \
                "${PROJECT_FILE}" \
                ".components.${component}.container" \
                || die "${component}: Deployment target '${target}' requires container configuration."
            ;;

        s3)
            return 0
            ;;

        *)
            die "${component}: Unsupported deployment target '${target}'."
            ;;
    esac
}

validate_testing_rules() {

    local component="$1"

    #
    # Unit tests are optional, but if enabled they need a build tool.
    #
    if json_bool "${PROJECT_FILE}" ".components.${component}.testing.unit.enabled"; then
        json_get_optional \
            "${PROJECT_FILE}" \
            ".components.${component}.build.tool" \
            >/dev/null \
            || true
    fi

    #
    # E2E tests are optional, but if enabled they need a script.
    #
    if json_bool "${PROJECT_FILE}" ".components.${component}.testing.e2e.enabled"; then
        json_get \
            "${PROJECT_FILE}" \
            ".components.${component}.testing.e2e.script" \
            >/dev/null
    fi
}

validate_dependency_rules() {

    local component="$1"

    if ! json_exists "${PROJECT_FILE}" ".components.${component}.depends_on"; then
        return 0
    fi

    local dependency

    while read -r dependency
    do
        [[ -z "${dependency}" ]] && continue

        [[ "${dependency}" != "${component}" ]] \
            || die "${component}: Component cannot depend on itself."

        json_exists \
            "${PROJECT_FILE}" \
            ".components.${dependency}" \
            || die "${component}: Unknown dependency '${dependency}'."

    done < <(
        json_array \
            "${PROJECT_FILE}" \
            ".components.${component}.depends_on"
    )
}

###############################################################################
# Public Functions
###############################################################################

validate_business_rules() {

    log_info "Validating business rules..."

    local component

    while read -r component
    do
        validate_build_tool_rules "${component}"
        validate_deployment_rules "${component}"
        validate_testing_rules "${component}"
        validate_dependency_rules "${component}"
    done < <(
        json_keys "${PROJECT_FILE}" ".components"
    )

    log_success "Business rules validation passed."
}
