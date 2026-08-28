# Universal Jenkins Pipeline
# Project Configuration Schema

Version: 1.0

---

# Overview

`project.json` is the central configuration file used by the Universal Jenkins Pipeline.

Its purpose is to describe the application, not the CI/CD infrastructure.

This file must **NOT** contain:

- AWS Account IDs
- AWS Regions
- Credentials
- Registry URLs
- Jenkins Environment Variables
- Shell Commands
- Build Commands
- Deployment Commands

Those belong to Jenkins and the pipeline scripts.

---

# Configuration Structure

```text
project.json

├── project
├── features
├── build
├── container
└── deployment
```

---

# project

General application metadata.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| name | ✅ | string | Unique project name |
| type | ✅ | string | Project category |
| language | ✅ | string | Programming language |
| framework | ❌ | string | Application framework |

---

## project.name

Example

```json
"name": "payment-api"
```

Rules

- Must be unique
- Lowercase recommended
- Use hyphen (-) instead of spaces

Example

```
payment-api
user-service
notification-worker
```

---

## project.type

Purpose

Defines what kind of application this is.

Valid values

| Value | Description |
|--------|-------------|
| service | Backend API or service |
| website | Static website |
| worker | Background worker |
| kiosk | Kiosk application |
| cli | Command-line application |
| library | Shared library |

Example

```json
"type": "service"
```

---

## project.language

Purpose

Primary programming language.

Valid values

| Value |
|-------|
| nodejs |
| go |
| java |
| python |
| dotnet |
| php |
| static |

Example

```json
"language": "nodejs"
```

---

## project.framework

Purpose

Application framework.

Optional.

Valid values

| Value |
|-------|
| none |
| express |
| nestjs |
| fastify |
| gin |
| fiber |
| spring |
| django |
| flask |
| fastapi |
| react |
| vue |
| angular |

Example

```json
"framework": "express"
```

---

# features

Enable or disable pipeline stages.

| Property | Type | Description |
|----------|------|-------------|
| quality | boolean | Run code quality stage |
| security | boolean | Run security scan |
| unit_tests | boolean | Run unit tests |
| container | boolean | Build container image |
| deployment | boolean | Deploy application |

Example

```json
"features": {
  "quality": true,
  "security": true,
  "unit_tests": true,
  "container": true,
  "deployment": true
}
```

---

# build

Build configuration.

| Property | Required | Description |
|----------|----------|-------------|
| tool | ✅ | Build tool |
| artifact_directory | ✅ | Output directory |

---

## build.tool

Valid values

| Value |
|-------|
| npm |
| pnpm |
| yarn |
| bun |
| go |
| maven |
| gradle |
| pip |
| poetry |

Example

```json
"tool": "npm"
```

---

## build.artifact_directory

Example

```json
"artifact_directory": "dist"
```

Examples

```
dist
build
target
bin
publish
```

---

# container

Container image configuration.

| Property | Required | Description |
|----------|----------|-------------|
| dockerfile | ✅ | Dockerfile location |
| context | ✅ | Docker build context |
| repository | ✅ | Container image repository |

---

## container.dockerfile

Example

```json
"dockerfile": "Dockerfile"
```

Possible values

```
Dockerfile
docker/Dockerfile
backend/Dockerfile
```

---

## container.context

Example

```json
"context": "."
```

Possible values

```
.
backend
frontend
src
```

---

## container.repository

Purpose

Destination image repository.

Example

```json
"repository": "payment-api"
```

---

# deployment

Deployment configuration.

| Property | Required | Description |
|----------|----------|-------------|
| strategy | ✅ | Deployment strategy |
| target | ✅ | Deployment platform |

---

## deployment.strategy

Valid values

| Value |
|-------|
| rolling |
| blue-green |
| canary |
| recreate |

Example

```json
"strategy": "rolling"
```

---

## deployment.target

Valid values

| Value |
|-------|
| compose |
| ecs |
| eks |
| vm |
| kubernetes |
| nomad |

Example

```json
"target": "ecs"
```

---

# Complete Example

```json
{
  "project": {
    "name": "payment-api",
    "type": "service",
    "language": "nodejs",
    "framework": "express"
  },
  "features": {
    "quality": true,
    "security": true,
    "unit_tests": true,
    "container": true,
    "deployment": true
  },
  "build": {
    "tool": "npm",
    "artifact_directory": "dist"
  },
  "container": {
    "dockerfile": "Dockerfile",
    "context": ".",
    "repository": "payment-api"
  },
  "deployment": {
    "strategy": "rolling",
    "target": "ecs"
  }
}
```

---

# Validation

Every project configuration is validated in three stages.

1. JSON Syntax Validation
2. JSON Schema Validation
3. Business Rule Validation

Pipeline execution starts only after all validations pass.

---

# Best Practices

✅ Keep the configuration simple.

✅ Store only project metadata.

✅ Enable only required features.

✅ Use lowercase values.

✅ Keep repository names consistent.

✅ Validate configuration before committing.

---

# Common Mistakes

❌ Store AWS Account IDs

❌ Store Credentials

❌ Store Registry URLs

❌ Store Build Commands

❌ Store Deployment Commands

❌ Store Jenkins Variables

❌ Store Shell Scripts

These belong to Jenkins or the pipeline scripts, not to `project.json`.

---

# Future Enhancements

Future schema versions may include:

- Runtime versions
- Multiple build artifacts
- Multi-container applications
- Multiple deployment targets
- Environment-specific overrides
- Custom pipeline extensions

Schema versioning will maintain backward compatibility whenever possible.
