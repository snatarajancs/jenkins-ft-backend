#!/usr/bin/env bash

###############################################################################
#
# File        : ecs.sh
# Description : Amazon ECS deployment implementation.
#
# Responsibilities
#   - Keep ECS deployment entry point in place
#   - Fail clearly until ECS schema/support is added
#
###############################################################################

set -Eeuo pipefail

###############################################################################
# Public Functions
###############################################################################

#
# Deploy an ECS component.
#
# Usage:
#   deployment_ecs <component>
#
deployment_ecs() {

    local component="$1"

    die "${component}: ECS deployment is not enabled in this V1 schema. Add ECS fields to project.schema.json before enabling ECS deployment."
}