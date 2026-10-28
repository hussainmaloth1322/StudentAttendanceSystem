
pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Check Node and npm') {
            steps {
                bat 'node --version'
                bat 'npm --version'
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'npm ci'
            }
        }

        stage('Run Tests') {
            steps {
                bat 'npm test'
            }
        }

        stage('Build Docker Image') {
            steps {
                bat '''
                    @echo off
                    set "PATH=C:/Users/Maloth Hussain/AppData/Local/Programs/DockerDesktop/resources/bin;%PATH%"
                    docker --version
                    docker build -t student-attendance-system:latest .
                '''
            }
        }
    }

    post {
        success {
            echo 'All pipeline stages completed successfully.'
        }
        failure {
            echo 'Pipeline failed. Check Console Output.'
        }
    }
}
