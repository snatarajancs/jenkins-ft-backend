#!/usr/bin/env bash

###############################################################################
#
# File        : s3.sh
# Description : Amazon S3 deployment implementation.
#
# Responsibilities
#   - Upload static files to S3
#   - Invalidate CloudFront cache (optional)
#
###############################################################################

set -Eeuo pipefail

###############################################################################
# Public Functions
###############################################################################

#
# Deploy an S3 component.
#
# Usage:
#   deployment_s3 <component>
#
deployment_s3() {

    local component="$1"

    local source
    local artifact_directory
    local bucket
    local distribution_id

    #
    # Deployment configuration.
    #
    source="$(
        json_get \
            "${PROJECT_FILE}" \
            ".components.${component}.source"
    )"

    artifact_directory="$(
        json_get_optional \
            "${PROJECT_FILE}" \
            ".components.${component}.build.artifact_directory"
    )"

    bucket="$(
        json_get \
            "${PROJECT_FILE}" \
            ".components.${component}.deployment.bucket"
    )"

    distribution_id="$(
        json_get_optional \
            "${PROJECT_FILE}" \
            ".components.${component}.deployment.cloudfront_distribution_id"
    )"

    artifact_directory="${artifact_directory:-dist}"

    log_info "Deploying '${component}'..."
    log_info "Bucket : ${bucket}"

    aws s3 sync \
        "${PROJECT_ROOT}/${source}/${artifact_directory}" \
        "s3://${bucket}" \
        --delete

    if [[ -n "${distribution_id}" ]]; then

        log_info "Invalidating CloudFront cache..."

        aws cloudfront create-invalidation \
            --distribution-id "${distribution_id}" \
            --paths '/*'

    fi

    log_success "${component}: S3 deployment completed."
}