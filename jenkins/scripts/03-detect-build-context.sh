#!/usr/bin/env bash

###############################################################################
#
# File        : 03-detect-build-context.sh
# Description : Detect Jenkins build context and deployment profile.
#
# Rules
#   - Normal configured branches use project.json environment/profile.
#   - Feature branches are non-deployment builds.
#   - Pull Request deployment is manual only.
#   - Manual PR deployment always targets the development environment.
#
###############################################################################

set -Eeuo pipefail

###############################################################################
# Paths
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JENKINS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

###############################################################################
# Load libraries
###############################################################################

# shellcheck disable=SC1091
source "${JENKINS_DIR}/common.sh"

# shellcheck disable=SC1091
source "${JENKINS_DIR}/helpers/json.sh"

###############################################################################
# Runtime context
###############################################################################

readonly CONTEXT_FILE="${JENKINS_DIR}/runtime/pipeline-context.json"

###############################################################################
# Main
###############################################################################

main() {

    log_header "Detect Build Context"

    local build_type
    local branch="N/A"
    local target_branch="N/A"
    local tag="N/A"

    local routing_branch=""
    local environment="feature"
    local profile="none"
    local pr_deploy="false"

    ###########################################################################
    # Pull Request
    #
    # Jenkins GitHub Multibranch may expose a PR as:
    #
    #   CHANGE_ID
    #   BRANCH_NAME=PR-123
    #
    ###########################################################################

    if [[ -n "${CHANGE_ID:-}" ||
          "${BRANCH_NAME:-}" =~ ^PR-[0-9]+$ ]]; then

        build_type="pull_request"

        branch="${CHANGE_BRANCH:-${BRANCH_NAME:-N/A}}"
        target_branch="${CHANGE_TARGET:-N/A}"

        #######################################################################
        # PR deployment is manual only.
        # All manual PR deployments go to dev.
        #######################################################################

        if [[ "${DEPLOY_PR:-false}" == "true" ]]; then

            pr_deploy="true"
            routing_branch="dev"

            log_info "Manual PR deployment requested."
            log_info "Deployment environment: development"
            log_info "Deployment branch    : dev"

        else

            # Normal PR build does not deploy.
            routing_branch=""

            log_info "Pull Request build detected."
            log_info "PR deployment is disabled."

        fi

    ###########################################################################
    # Tag
    ###########################################################################

    elif [[ -n "${TAG_NAME:-}" ]]; then

        build_type="tag"
        tag="${TAG_NAME}"

        routing_branch=""

    ###########################################################################
    # Normal branch
    ###########################################################################

    else

        build_type="branch"

        branch="${BRANCH_NAME:-${GIT_LOCAL_BRANCH:-${GIT_BRANCH:-}}}"

        branch="${branch#origin/}"
        branch="${branch#refs/heads/}"

        if [[ -z "${branch}" ]]; then
            die "Branch name is unavailable."
        fi

        routing_branch="${branch}"

    fi

    ###########################################################################
    # Normalize routing branch
    ###########################################################################

    routing_branch="${routing_branch#origin/}"
    routing_branch="${routing_branch#refs/heads/}"
    routing_branch="${routing_branch,,}"

    ###########################################################################
    # Resolve environment from project.json
    #
    # Only branches explicitly configured in project.json are deployment
    # environments. Everything else remains a feature build.
    ###########################################################################

    if [[ -n "${routing_branch}" ]]; then

        environment="$(
            jq -r \
                --arg branch "${routing_branch}" \
                '
                [
                    .environments
                    | to_entries[]
                    | select(.value.branch == $branch)
                    | .key
                ][0] // "feature"
                ' \
                "${PROJECT_FILE}"
        )"

    fi

    ###########################################################################
    # Resolve deployment profile
    ###########################################################################

    if [[ "${environment}" != "feature" ]]; then

        profile="$(
            jq -er \
                --arg environment "${environment}" \
                '.environments[$environment].profile' \
                "${PROJECT_FILE}"
        )"

    fi

    ###########################################################################
    # Validate manual PR deployment
    #
    # Manual PR deployment is allowed only when the dev environment explicitly
    # permits PR deployments.
    ###########################################################################

    if [[ "${pr_deploy}" == "true" ]]; then

        jq -e \
            '
            any(
                .environments[];
                .branch == "dev" and
                .allow_pr_deploy == true
            )
            ' \
            "${PROJECT_FILE}" \
            >/dev/null \
            || die "PR deployment is not allowed for the development environment."

    fi

    ###########################################################################
    # Display context
    ###########################################################################

    log_info "Build Type      : ${build_type}"
    log_info "Branch          : ${branch}"
    log_info "Target Branch   : ${target_branch}"
    log_info "Routing Branch  : ${routing_branch:-N/A}"
    log_info "Tag             : ${tag}"
    log_info "Environment     : ${environment}"
    log_info "Profile         : ${profile}"
    log_info "PR Deployment   : ${pr_deploy}"

    ###########################################################################
    # Write runtime context
    ###########################################################################

    mkdir -p "$(dirname "${CONTEXT_FILE}")"

    jq -n \
        --arg build_type "${build_type}" \
        --arg branch "${branch}" \
        --arg target_branch "${target_branch}" \
        --arg tag "${tag}" \
        --arg routing_branch "${routing_branch}" \
        --arg environment "${environment}" \
        --arg profile "${profile}" \
        --argjson pr_deploy "${pr_deploy}" \
        '{
            build_type: $build_type,
            branch: $branch,
            target_branch: $target_branch,
            routing_branch: $routing_branch,
            tag: $tag,
            environment: $environment,
            profile: $profile,
            pr_deploy: $pr_deploy
        }' \
        > "${CONTEXT_FILE}"

    ###########################################################################
    # Validate generated context
    ###########################################################################

    jq empty "${CONTEXT_FILE}" >/dev/null 2>&1 ||
        die "Generated pipeline context is invalid."

    log_success "Pipeline context generated."
}

main "$@"