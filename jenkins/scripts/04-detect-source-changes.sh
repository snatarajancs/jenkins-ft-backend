#!/usr/bin/env bash

###############################################################################
#
# File        : 04-detect-source-changes.sh
# Description : Detect changed application components.
#
# Responsibilities
#   - Determine the correct Git base commit
#   - Detect changed files
#   - Map changed files to configured components
#   - Generate source-changes.json
#
###############################################################################

set -Eeuo pipefail

###############################################################################
# Paths
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JENKINS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_ROOT="$(cd "${JENKINS_DIR}/.." && pwd)"

###############################################################################
# Load Libraries
###############################################################################

# shellcheck disable=SC1091
source "${JENKINS_DIR}/common.sh"

###############################################################################
# Configuration
###############################################################################

readonly RUNTIME_DIR="${JENKINS_DIR}/runtime"
readonly OUTPUT_FILE="${RUNTIME_DIR}/source-changes.json"

###############################################################################
# Git Helpers
###############################################################################

git_ref_exists() {

    local ref="$1"

    git rev-parse --verify "${ref}^{commit}" >/dev/null 2>&1
}

get_base_commit() {

    # 1. Jenkins previous successful build
    if [[ -n "${GIT_PREVIOUS_SUCCESSFUL_COMMIT:-}" ]] \
        && git_ref_exists "${GIT_PREVIOUS_SUCCESSFUL_COMMIT}"
    then
        printf '%s\n' "${GIT_PREVIOUS_SUCCESSFUL_COMMIT}"
        return 0
    fi

    # 2. Pull Request target branch
    if [[ -n "${CHANGE_TARGET:-}" ]] \
        && git_ref_exists "origin/${CHANGE_TARGET}"
    then
        printf '%s\n' "origin/${CHANGE_TARGET}"
        return 0
    fi

    # 3. Main branch
    if git_ref_exists "origin/main"; then
        printf '%s\n' "origin/main"
        return 0
    fi

    # 4. Local development fallback
    if git_ref_exists "HEAD^"; then
        printf '%s\n' "HEAD^"
        return 0
    fi

    # 5. First commit / no parent
    git hash-object -t tree /dev/null
}

###############################################################################
# Main
###############################################################################

main() {

    log_header "Detect Source Changes"

    require_command git
    require_command jq

    require_file "${PROJECT_FILE}"

    mkdir -p "${RUNTIME_DIR}"

    cd "${PROJECT_ROOT}"

    local base_commit
    local current_commit
    local changed_components=()
    local changed_files=()

    current_commit="$(git rev-parse HEAD)"
    base_commit="$(get_base_commit)"

    log_info "Base Commit    : ${base_commit}"
    log_info "Current Commit : ${current_commit}"

    ###########################################################################
    # Detect changes per configured component
    ###########################################################################

    while IFS=$'\t' read -r component source
    do

        [[ -n "${component}" ]] || continue
        [[ -n "${source}" ]] || continue

        local component_changes

        component_changes="$(
            git diff --name-only \
                "${base_commit}" \
                "${current_commit}" \
                -- "${source}"
        )"

        if [[ -n "${component_changes}" ]]; then

            log_info "Changed Component : ${component}"

            changed_components+=("${component}")

            while IFS= read -r file
            do
                [[ -n "${file}" ]] || continue
                changed_files+=("${file}")
            done <<< "${component_changes}"

        fi

    done < <(
        jq -r '
            .components
            | to_entries[]
            | [.key, .value.source]
            | @tsv
        ' "${PROJECT_FILE}"
    )

    ###########################################################################
    # Generate JSON result
    ###########################################################################

    local components_json
    local files_json

    if ((${#changed_components[@]} > 0)); then
        components_json="$(
            printf '%s\n' "${changed_components[@]}" |
                jq -R . |
                jq -s .
        )"
    else
        components_json='[]'
    fi

    if ((${#changed_files[@]} > 0)); then
        files_json="$(
            printf '%s\n' "${changed_files[@]}" |
                jq -R . |
                jq -s .
        )"
    else
        files_json='[]'
    fi

    jq -n \
        --arg base_commit "${base_commit}" \
        --arg current_commit "${current_commit}" \
        --argjson changed_components "${components_json}" \
        --argjson changed_files "${files_json}" \
        '
        {
            base_commit: $base_commit,
            current_commit: $current_commit,
            changed_components: $changed_components,
            changed_files: $changed_files,
            changed_component_count: ($changed_components | length),
            changes_detected: (($changed_components | length) > 0)
        }
        ' > "${OUTPUT_FILE}"

    ###########################################################################
    # Summary
    ###########################################################################

    local changed_count

    changed_count="${#changed_components[@]}"

    log_info "Changed Components : ${changed_count}"

    if ((changed_count == 0)); then
        log_info "No configured application component changes detected."
    else
        log_success "Application component changes detected."
    fi

    log_success "Source change detection completed."
}

###############################################################################
# Main
###############################################################################

main "$@"