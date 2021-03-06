/* *****************************************************************************
 * * Copyright 2019 Amazon.com, Inc. and its affiliates. All Rights Reserved.  *
 *                                                                             *
 * Licensed under the Amazon Software License (the "License").                 *
 *  You may not use this file except in compliance with the License.           *
 * A copy of the License is located at                                         *
 *                                                                             *
 *  http://aws.amazon.com/asl/                                                 *
 *                                                                             *
 *  or in the "license" file accompanying this file. This file is distributed  *
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either  *
 *  express or implied. See the License for the specific language governing    *
 *  permissions and limitations under the License.                             *
 * *************************************************************************** *
*/

import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as sns from '@aws-cdk/aws-sns';
import * as lambda from '@aws-cdk/aws-lambda';
import { SnsEventSource } from '@aws-cdk/aws-lambda-event-sources'

interface Props extends cdk.StackProps {
}

export class CommonLambdaStack extends cdk.Stack {
  public readonly lambdaExecutionRole: iam.IRole;
  public readonly doneTopic: sns.ITopic;
  public readonly failTopic: sns.ITopic;

  constructor(scope: cdk.Construct, id: string, props?: Props) {
    super(scope, id, props);

    const notifySender = scope.node.tryGetContext('notifySender') || '';
    const notifyEmail = scope.node.tryGetContext('notifyEmail') || '';
    const notifySlack = scope.node.tryGetContext('notifySlack') || '';

    this.lambdaExecutionRole = new iam.Role(this, 'PersonalizeLambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        { managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole' },
        { managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AmazonPersonalizeFullAccess' },
        { managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonS3FullAccess' },
        { managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonSESFullAccess' },
      ],
    });

    this.doneTopic = new sns.Topic(this, 'DoneTopic');
    this.failTopic = new sns.Topic(this, 'FailTopic');

    // Notification
    const notifyDoneFunction = new lambda.Function(this, 'NotifyDoneFunction', {
      runtime: lambda.Runtime.PYTHON_3_7,
      code: lambda.Code.fromAsset(path.resolve(__dirname, '..', '..', 'functions', 'common')),
      handler: 'notify.handler',
      role: this.lambdaExecutionRole,
      timeout: cdk.Duration.seconds(5),
      environment: {
        'STATUS': 'DONE',
        'SENDER': notifySender,
        'TO_ADDR': notifyEmail,
        'SLACK_WEBHOOK_URL': notifySlack,
      },
    });
    notifyDoneFunction.addEventSource(new SnsEventSource(this.doneTopic));

    const notifyFailFunction = new lambda.Function(this, 'NotifyFailFunction', {
      runtime: lambda.Runtime.PYTHON_3_7,
      code: lambda.Code.fromAsset(path.resolve(__dirname, '..', '..', 'functions', 'common')),
      handler: 'notify.handler',
      role: this.lambdaExecutionRole,
      timeout: cdk.Duration.seconds(5),
      environment: {
        'STATUS': 'FAILED',
        'SENDER': notifySender,
        'TO_ADDR': notifyEmail,
        'SLACK_WEBHOOK_URL': notifySlack,
      },
    });
    notifyFailFunction.addEventSource(new SnsEventSource(this.failTopic));
  }

}