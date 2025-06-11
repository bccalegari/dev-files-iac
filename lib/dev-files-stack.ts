import {
    aws_ec2 as ec2,
    aws_iam as iam,
    aws_s3 as s3,
    aws_secretsmanager as secretsmanager,
    CfnOutput,
    RemovalPolicy,
    Stack,
    StackProps,
} from 'aws-cdk-lib';
import {Construct} from 'constructs';

interface DevFilesEc2StackProps extends StackProps {
    gitHubRepoUrl: string;
}

export class DevFilesEc2Stack extends Stack {
    constructor(scope: Construct, id: string, props: DevFilesEc2StackProps) {
        super(scope, id, props);

        const vpc = new ec2.Vpc(this, 'DevFilesVPC', {
            maxAzs: 1,
            ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
            subnetConfiguration: [
                {
                    name: 'Public',
                    subnetType: ec2.SubnetType.PUBLIC,
                    cidrMask: 24,
                },
            ],
            natGateways: 0,
        });

        const ec2Role = new iam.Role(this, 'DevFilesEc2Role', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
            ],
        });

        new s3.Bucket(this, 'DevFilesBucket', {
            bucketName: 'dev-files-bucket',
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true
        });

        const postgresPasswordSecret = new secretsmanager.Secret(this, 'DevFilesPostgresPassword', {
            generateSecretString: {
                passwordLength: 16,
                excludeCharacters: '@/"\' \\',
                secretStringTemplate: '{"username": "devfiles", "password": ""}',
                generateStringKey: 'password',
            },
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const rabbitmqDefaultSecret = new secretsmanager.Secret(this, 'DevFilesRabbitMQDefaultPassword', {
            generateSecretString: {
                passwordLength: 16,
                excludeCharacters: '@/"\' \\',
                secretStringTemplate: '{"username": "devfiles", "password": ""}',
                generateStringKey: 'password',
            },
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const rabbitmqNotificationSecret = new secretsmanager.Secret(this, 'DevFilesRabbitMQNotificationPassword', {
            generateSecretString: {
                passwordLength: 16,
                excludeCharacters: '@/"\' \\',
                secretStringTemplate: '{"username": "notification", "password": ""}',
                generateStringKey: 'password',
            },
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const rabbitmqErlangCookieSecret = new secretsmanager.Secret(this, 'DevFilesRabbitMQErlangCookie', {
            generateSecretString: {
                passwordLength: 16,
                excludeCharacters: '@/"\' \\',
                secretStringTemplate: '{"username": "notification", "password": ""}',
                generateStringKey: 'password',
            },
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const jwtSecretKeySecret = new secretsmanager.Secret(this, 'DevFilesJWTSecretKey', {
            generateSecretString: {
                passwordLength: 32,
                excludeCharacters: '@/"\' \\',
            },
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const aiServiceKeySecret = new secretsmanager.Secret(this, 'DevFilesAIServiceKey', {
            generateSecretString: {
                passwordLength: 32,
                excludeCharacters: '@/"\' \\',
                secretStringTemplate: '{"key": ""}',
                generateStringKey: 'key',
            },
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const redisPasswordSecret = new secretsmanager.Secret(this, 'DevFilesRedisPassword', {
            generateSecretString: {
                passwordLength: 16,
                excludeCharacters: '@/"\' \\',
            },
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const awsAccessKeyIdSecret = secretsmanager.Secret.fromSecretNameV2(
            this, 'DevFilesAWSAccessKeyId', 'DevFilesAWSAccessKeyIdSecretName'
        );
        const awsSecretAccessKeySecret = secretsmanager.Secret.fromSecretNameV2(
            this, 'DevFilesAWSSecretAccessKey', 'DevFilesAWSSecretAccessKeySecretName'
        );

        const mailSenderSecret = secretsmanager.Secret.fromSecretNameV2(
            this, 'DevFilesMailSender', 'DevFilesMailSenderSecretName'
        );

        const mailPasswordSecret = new secretsmanager.Secret(this, 'DevFilesMailPassword', {
            generateSecretString: {
                passwordLength: 16,
                excludeCharacters: '@/"\' \\',
            },
            removalPolicy: RemovalPolicy.DESTROY,
        });

        ec2Role.addToPolicy(new iam.PolicyStatement({
            actions: ['secretsmanager:GetSecretValue'],
            resources: [
                postgresPasswordSecret.secretArn,
                rabbitmqDefaultSecret.secretArn,
                rabbitmqNotificationSecret.secretArn,
                jwtSecretKeySecret.secretArn,
                redisPasswordSecret.secretArn,
                awsAccessKeyIdSecret.secretArn,
                awsSecretAccessKeySecret.secretArn,
                mailPasswordSecret.secretArn,
            ],
        }));

        const ec2Sg = new ec2.SecurityGroup(this, 'DevFilesEc2SecurityGroup', {
            vpc,
            description: 'Access to DevFiles EC2 instance',
            allowAllOutbound: true,
        });

        const allowedPorts = [
            { port: 22, desc: 'SSH' },
            { port: 80, desc: 'DevFiles Service' },
            { port: 5432, desc: 'PostgreSQL' },
            { port: 6379, desc: 'Redis' },
            { port: 15673, desc: 'RabbitMQ UI' },
            { port: 8000, desc: 'ChromaDB' },
        ];

        allowedPorts.forEach(p =>
            ec2Sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(p.port), p.desc)
        );

        const userData = ec2.UserData.forLinux();
        userData.addCommands(
            '#!/bin/bash',
            'set -e',

            'yum update -y',
            'amazon-linux-extras install docker -y',
            'service docker start',
            'usermod -a -G docker ec2-user',
            'chkconfig docker on',
            'DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}',
            'mkdir -p $DOCKER_CONFIG/cli-plugins',
            'curl -SL https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-linux-x86_64 -o $DOCKER_CONFIG/cli-plugins/docker-compose',
            'chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose',
            'yum install -y git jq',

            `git clone ${props.gitHubRepoUrl} /home/ec2-user/devfiles-monorepo`,
            'cd /home/ec2-user/devfiles-monorepo',

            `POSTGRES_PASSWORD_VAL=$(aws secretsmanager get-secret-value --secret-id ${postgresPasswordSecret.secretArn} --query SecretString --output text | jq -r .password)`,
            `POSTGRES_USER_VAL=$(aws secretsmanager get-secret-value --secret-id ${postgresPasswordSecret.secretArn} --query SecretString --output text | jq -r .username)`,

            `RABBITMQ_DEFAULT_PASS_VAL=$(aws secretsmanager get-secret-value --secret-id ${rabbitmqDefaultSecret.secretArn} --query SecretString --output text | jq -r .password)`,
            `RABBITMQ_DEFAULT_USER_VAL=$(aws secretsmanager get-secret-value --secret-id ${rabbitmqDefaultSecret.secretArn} --query SecretString --output text | jq -r .username)`,
            `RABBITMQ_ERLANG_COOKIE_VAL=$(aws secretsmanager get-secret-value --secret-id ${rabbitmqErlangCookieSecret.secretArn} --query SecretString --output text | jq -r .password)`,

            `NOTIFICATION_SERVICE_PASS_VAL=$(aws secretsmanager get-secret-value --secret-id ${rabbitmqNotificationSecret.secretArn} --query SecretString --output text | jq -r .password)`,
            `NOTIFICATION_SERVICE_USER_VAL=$(aws secretsmanager get-secret-value --secret-id ${rabbitmqNotificationSecret.secretArn} --query SecretString --output text | jq -r .username)`,

            `JWT_SECRET_KEY_VAL=$(aws secretsmanager get-secret-value --secret-id ${jwtSecretKeySecret.secretArn} --query SecretString --output text)`,

            `AI_SERVICE_KEY_VAL=$(aws secretsmanager get-secret-value --secret-id ${aiServiceKeySecret.secretArn} --query SecretString --output text | jq -r .key)`,

            `REDIS_PASSWORD_VAL=$(aws secretsmanager get-secret-value --secret-id ${redisPasswordSecret.secretArn} --query SecretString --output text)`,

            `AWS_ACCESS_KEY_ID_VAL=$(aws secretsmanager get-secret-value --secret-id ${awsAccessKeyIdSecret.secretArn} --query SecretString --output text | jq -r .AccessKeyId)`,
            `AWS_SECRET_ACCESS_KEY_VAL=$(aws secretsmanager get-secret-value --secret-id ${awsSecretAccessKeySecret.secretArn} --query SecretString --output text | jq -r .SecretAccessKey)`,

            `MAIL_SENDER_EMAIL_VAL=$(aws secretsmanager get-secret-value --secret-id ${mailSenderSecret.secretArn} --query SecretString --output text | jq -r .email)`,
            `MAIL_PASSWORD_VAL=$(aws secretsmanager get-secret-value --secret-id ${mailPasswordSecret.secretArn} --query SecretString --output text)`,

            'cat <<EOF_ENV > .env',
            'SPRING_PROFILES_ACTIVE=prd',

            '# PostgreSQL',
            'POSTGRES_DB=devfiles',
            'POSTGRES_USER=${POSTGRES_USER_VAL}',
            'POSTGRES_PASSWORD=${POSTGRES_PASSWORD_VAL}',
            'POSTGRES_URL=jdbc:postgresql://devfiles-postgres:5432/devfiles',

            '# RabbitMQ',
            'RABBITMQ_ERLANG_COOKIE=${RABBITMQ_ERLANG_COOKIE_VAL}',
            'RABBITMQ_DEFAULT_USER=${RABBITMQ_DEFAULT_USER_VAL}',
            'RABBITMQ_DEFAULT_PASS=${RABBITMQ_DEFAULT_PASS_VAL}',

            '# JWT',
            'JWT_SECRET_KEY=${JWT_SECRET_KEY_VAL}',

            '# Redis',
            'REDIS_PASSWORD=${REDIS_PASSWORD_VAL}',

            '# AWS',
            'AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID_VAL}',
            'AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY_VAL}',
            'AWS_BUCKET_NAME=devfiles-bucket',

            '# AI Service',
            'AI_SERVICE_URL=http://ai-service:5000',
            'AI_SERVICE_KEY=${AI_SERVICE_KEY_VAL}',
            'AI_SERVICE_PORT=5000',
            'OLLAMA_LLM_BASE_URL=http://ollama_llm:11434',
            'OLLAMA_EMBEDDING_BASE_URL=http://ollama_embedding:11435',
            'CHROMA_DB_HOST=chroma_db',
            'CHROMA_DB_PORT=8000',

            '# Notification Service',
            'NOTIFICATION_SERVICE_USER=${NOTIFICATION_SERVICE_USER_VAL}',
            'NOTIFICATION_SERVICE_PASS=${NOTIFICATION_SERVICE_PASS_VAL}',
            'MAIL_SENDER_EMAIL=${MAIL_SENDER_EMAIL_VAL}',
            'MAIL_HOST=smtp.sendgrid.net',
            'MAIL_PORT=587',
            'MAIL_USERNAME=apikey',
            'MAIL_PASSWORD=${MAIL_PASSWORD_VAL}',

            '# DevFiles Service',
            'DEV_FILES_SERVICE_PORT=8080',
            'EOF_ENV',

            'FOLDERS=("dev-files-api", "dev-files-notification", "dev-files-ai-service")',
            'for folder in "${FOLDERS[@]}"; do',
            '  cp .env "/home/ec2-user/devfiles-monorepo/$folder/.env"',
            'done',

            '$DOCKER_CONFIG/cli-plugins/docker-compose up -d'
        );

        const devfilesInstance = new ec2.Instance(this, 'DevfilesInstance', {
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.XLARGE2),
            machineImage: ec2.MachineImage.latestAmazonLinux2(),
            vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
            securityGroup: ec2Sg,
            role: ec2Role,
            userData,
        });

        new CfnOutput(this, 'InstancePublicIp', {
            value: devfilesInstance.instancePublicIp,
            description: 'Public ip address of the EC2 instance',
        });

        new CfnOutput(this, 'InstancePublicDns', {
            value: devfilesInstance.instancePublicDnsName,
            description: 'Public DNS of the EC2 instance',
        });
    }
}
