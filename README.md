# DevFiles Infrastructure (IaC)

> **Study project developed for learning purposes.**

This project defines the entire infrastructure required to deploy the **DevFiles** application using **Infrastructure as Code (IaC)** with **AWS CloudFormation** and the **AWS CDK (TypeScript)**.

It provisions and configures an EC2 instance, security groups, IAM roles, Secrets Manager, S3 bucket, CloudWatch logging, and any necessary networking and bootstrapping to host a Dockerized microservice system.

> This repository/module is part of the [DevFiles Monorepo](https://github.com/bccalegari/dev-files-monorepo), but can be used independently to provision infrastructure for remote deployment.

## Project Goals

- Automate the setup of the DevFiles runtime environment on AWS.
- Isolate credentials and secrets using AWS Secrets Manager.
- Bootstrap EC2 to run Docker Compose automatically on startup.
- Log system and application events to CloudWatch.

## Tech Stack

- AWS CloudFormation (via AWS CDK)
- CDK in TypeScript
- EC2, S3, IAM, CloudWatch, Secrets Manager
- Docker & Docker Compose (installed via EC2 user data)

## Architecture Overview

Once deployed, the IaC stack creates the following AWS resources:

| Resource           | Purpose                                                 |
|--------------------|----------------------------------------------------------|
| EC2 Instance       | Hosts the Docker containers for the application         |
| S3 Bucket          | Stores uploaded files                                    |
| IAM Roles/Policies | Allow secure access to AWS services from EC2            |
| Secrets Manager    | Stores credentials and API keys                          |
| CloudWatch Logs    | Captures logs from the EC2 instance and services         |
| Security Groups    | Controls inbound/outbound access to the EC2 instance     |
| User Data Script   | Installs Docker, pulls the project, creates `.env`, etc. |

## Prerequisites

- AWS CLI configured with sufficient permissions
- Node.js and npm
- AWS CDK installed globally
- Secrets for the application stored in AWS Secrets Manager

```bash
npm install -g aws-cdk
```

### Secrets needed in AWS Secrets Manager
AWS Credentials and Mail Sender credentials are required to be stored in AWS Secrets Manager before deploying the stack. The secrets should be named as follows:
- `DevFilesAWSAccessKeyIdSecretName`
- `DevFilesAWSSecretAccessKeySecretName`
- `DevFilesMailSenderSecretName`

Secrets can be created manually via AWS Console or CLI.

## Deployment Steps
1. **Clone the repository:**

   ```bash
   git clone https://github.com/bccalegari/dev-files-iac.git
   ````

2. **Navigate to the project directory:**

   ```bash
    cd dev-files-iac
    ```

3. **Install dependencies:**
    ```bash
    npm install
    ```

4. **Deploy the stack:**
    <br>
    Make sure you have configured your AWS credentials and region.
    ```bash
    npm run deploy
    ```

5. **Monitor the deployment:**
    You can check the AWS Management Console for the created resources or use the AWS CLI to verify.

## Post-Deployment
After deployment, you can access the EC2 instance to manage your Docker containers. The application will be running based on the configurations defined in the `.env` file and Docker Compose setup.

## Cleanup
To remove the deployed resources, run:

```bash
npm run destroy
```

---

> **Study project developed for learning purposes.**

Built with ❤️ by Bruno Calegari