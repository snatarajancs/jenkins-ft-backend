// groovylint-disable CompileStatic, DuplicateStringLiteral

pipeline {

    agent {
        label 'master'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout(true)

        // Retain recent builds and deployment/security artifacts.
        buildDiscarder(logRotator(
            daysToKeepStr: '30',
            numToKeepStr: '30',
            artifactDaysToKeepStr: '30',
            artifactNumToKeepStr: '10'
        ))
    }

    parameters {

        // Enable optional code quality validation.
        booleanParam(
            name: 'RUN_CODE_QUALITY',
            defaultValue: false,
            description: 'Run code quality checks'
        )

        // Enable application test execution.
        booleanParam(
            name: 'RUN_TESTS',
            defaultValue: false,
            description: 'Run application tests'
        )

        // Enable optional end-to-end test execution.
        booleanParam(
            name: 'RUN_E2E_TESTS',
            defaultValue: false,
            description: 'Run E2E tests'
        )

        // Control deployment execution.
        booleanParam(
            name: 'DEPLOY_ENABLED',
            defaultValue: true,
            description: 'Enable deployment for configured environments'
        )

        // Allow manual PR deployment to the development environment.
        booleanParam(
            name: 'DEPLOY_PR',
            defaultValue: false,
            description: 'Manually enable deployment of a Pull Request to development'
        )
    }

    environment {
        PROJECT_CONFIG = 'jenkins/config/project.json'
        JENKINS_DIR = 'jenkins'
    }

    stages {

        // Checkout the source configured by Jenkins Multibranch.
        stage('Checkout Source') {
            steps {
                checkout scm
            }
        }

        // Initialize Jenkins runtime directories and files.
        stage('Initialize') {
            steps {
                sh "bash ${JENKINS_DIR}/scripts/01-initialize-environment.sh"
            }
        }

        // Validate project configuration and business rules.
        stage('Validate Project') {
            steps {
                sh "bash ${JENKINS_DIR}/scripts/02-validate-project.sh"
            }
        }

        // Detect branch, PR context, environment, and deployment profile.
        stage('Detect Build Context') {
            steps {
                sh "bash ${JENKINS_DIR}/scripts/03-detect-build-context.sh"
            }
        }

        // Detect changed application components for incremental processing.
        stage('Detect Source Changes') {
            steps {
                sh "bash ${JENKINS_DIR}/scripts/04-detect-source-changes.sh"
            }
        }

        // Install dependencies required by application build and validation.
        stage('Install Dependencies') {
            steps {
                sh "ls -la"
                sh "pwd"
                sh "bash ${JENKINS_DIR}/scripts/05-install-dependencies.sh"
            }
        }

        // Run code quality checks when explicitly enabled.
        stage('Code Quality') {
            when {
                expression {
                    params.RUN_CODE_QUALITY
                }
            }

            steps {
                sh "bash ${JENKINS_DIR}/scripts/06-code-quality.sh"
            }
        }

        // Run application tests when enabled.
        stage('Run Tests') {
            when {
                expression {
                    params.RUN_TESTS
                }
            }

            steps {
                sh "bash ${JENKINS_DIR}/scripts/07-run-tests.sh"
            }
        }

        // Build the application before container creation.
        stage('Build Application') {
            steps {
                sh "bash ${JENKINS_DIR}/scripts/08-build-application.sh"
            }
        }

        // Run end-to-end tests when explicitly enabled.
        stage('Run E2E Tests') {
            when {
                expression {
                    params.RUN_E2E_TESTS
                }
            }

            steps {
                sh "bash ${JENKINS_DIR}/scripts/09-run-e2e-tests.sh"
            }
        }

        // Build Docker images only for configured deployment environments.
        stage('Build Docker Image') {
            when {
                expression {
                    sh(
                        script: """
                            jq -e '
                                .environment != "feature"
                            ' ${JENKINS_DIR}/runtime/pipeline-context.json
                        """,
                        returnStatus: true
                    ) == 0
                }
            }

            steps {
                sh "bash ${JENKINS_DIR}/scripts/10-build-docker.sh"
            }
        }

        // Scan deployment images for container vulnerabilities.
        stage('Container Security Scan') {
            when {
                expression {
                    sh(
                        script: """
                            jq -e '
                                .environment != "feature"
                            ' ${JENKINS_DIR}/runtime/pipeline-context.json
                        """,
                        returnStatus: true
                    ) == 0
                }
            }

            options {
                timeout(
                    time: 15,
                    unit: 'MINUTES'
                )
            }

            steps {
                sh "bash ${JENKINS_DIR}/scripts/11-container-security-scan.sh"
            }
        }

        // Push deployment images to the configured container registry.
        stage('Push Docker Image') {
            when {
                expression {
                    sh(
                        script: """
                            jq -e '
                                .environment != "feature"
                            ' ${JENKINS_DIR}/runtime/pipeline-context.json
                        """,
                        returnStatus: true
                    ) == 0
                }
            }

            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'harbor-jenkins-ft-backend',
                        usernameVariable: 'REGISTRY_USERNAME',
                        passwordVariable: 'REGISTRY_PASSWORD'
                    )
                ]) {
                    sh "bash ${JENKINS_DIR}/scripts/12-push-image.sh"
                }
            }
        }

        // Deploy only when explicitly enabled and the context is deployable.
        stage('Deploy') {
            when {
                allOf {

                    expression {
                        params.DEPLOY_ENABLED
                    }

                    expression {
                        sh(
                            script: """
                                jq -e '
                                    .environment != "feature" and
                                    (
                                        .build_type != "pull_request" or
                                        .pr_deploy == true
                                    )
                                ' ${JENKINS_DIR}/runtime/pipeline-context.json
                            """,
                            returnStatus: true
                        ) == 0
                    }
                }
            }

            steps {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: 'deployment-ssh',
                        keyFileVariable: 'DEPLOY_SSH_KEY',
                        usernameVariable: 'DEPLOY_SSH_USER'
                    ),
                    file(
                        credentialsId: 'deployment-known-hosts',
                        variable: 'KNOWN_HOSTS_FILE'
                    )
                ]) {
                    sh "bash ${JENKINS_DIR}/scripts/13-deploy.sh"
                }
            }
        }
    }

    post {

        // Archive reports and remove temporary runtime data after every build.
        always {
            archiveArtifacts(
                artifacts: 'jenkins/reports/trivy/**',
                fingerprint: true,
                allowEmptyArchive: true
            )

            sh "bash ${JENKINS_DIR}/scripts/14-cleanup.sh"
        }

        // Report successful pipeline completion.
        success {
            echo 'Pipeline completed successfully.'
        }

        // Report failed pipeline completion.
        failure {
            echo 'Pipeline failed.'
        }
    }
}
