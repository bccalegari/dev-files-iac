#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import {DevFilesEc2Stack} from "../lib/dev-files-stack";

const app = new cdk.App();
new DevFilesEc2Stack(app, 'DevFilesEc2Stack', {
    gitHubRepoUrl: 'mock-repo-url',
});