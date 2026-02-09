# Deployment Guide (AWS EKS + Helm, Step by Step)

This procedure is written for `us-east-1` with separate `dev` and `prod`.

## 1. Install required CLIs
```bash
brew install awscli kubectl helm eksctl jq
docker --version
```

## 2. Set shell variables
```bash
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export CLUSTER_DEV=relationship-reward-dev
export CLUSTER_PROD=relationship-reward-prod
export NAMESPACE_DEV=relationship-reward-dev
export NAMESPACE_PROD=relationship-reward-prod
```

## 3. Create ECR repositories
```bash
aws ecr create-repository --repository-name reward-api --region $AWS_REGION
aws ecr create-repository --repository-name reward-worker --region $AWS_REGION
aws ecr create-repository --repository-name reward-web --region $AWS_REGION
aws ecr create-repository --repository-name reward-scheduler-py --region $AWS_REGION
```

## 4. Create dev EKS cluster (cost-safe baseline)
```bash
eksctl create cluster \
  --name $CLUSTER_DEV \
  --region $AWS_REGION \
  --nodegroup-name ng-dev \
  --managed \
  --node-type t4g.small \
  --nodes 1 \
  --nodes-min 1 \
  --nodes-max 1 \
  --zones us-east-1a
```

## 5. Enable OIDC and install controllers
```bash
eksctl utils associate-iam-oidc-provider \
  --cluster $CLUSTER_DEV \
  --region $AWS_REGION \
  --approve
```

Install AWS Load Balancer Controller:
```bash
helm repo add eks https://aws.github.io/eks-charts
helm repo update
helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=$CLUSTER_DEV \
  --set serviceAccount.create=true \
  --set region=$AWS_REGION \
  --set vpcId=<YOUR_VPC_ID>
```

Install External Secrets Operator:
```bash
helm repo add external-secrets https://charts.external-secrets.io
helm repo update
helm upgrade --install external-secrets external-secrets/external-secrets \
  -n external-secrets \
  --create-namespace
```

Create cluster secret store (`cluster-secret-store.yaml`):
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: aws-secrets-manager
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets
            namespace: external-secrets
```

```bash
kubectl apply -f cluster-secret-store.yaml
```

## 6. Create app secrets in AWS Secrets Manager
```bash
aws secretsmanager create-secret --name /relationship-reward/MONGODB_URI --secret-string '<mongodb-uri>'
aws secretsmanager create-secret --name /relationship-reward/JWT_ACCESS_SECRET --secret-string '<32+ chars>'
aws secretsmanager create-secret --name /relationship-reward/JWT_REFRESH_SECRET --secret-string '<32+ chars>'
aws secretsmanager create-secret --name /relationship-reward/REDIS_URL --secret-string '<redis-url>'
aws secretsmanager create-secret --name /relationship-reward/SES_FROM_EMAIL --secret-string 'reminders@yourdomain.com'
```

## 7. Build and push images
```bash
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

export IMAGE_TAG=dev-$(git rev-parse --short HEAD)

docker build -f apps/api/Dockerfile \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/reward-api:$IMAGE_TAG .
docker build -f apps/worker/Dockerfile \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/reward-worker:$IMAGE_TAG .
docker build -f apps/scheduler-py/Dockerfile \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/reward-scheduler-py:$IMAGE_TAG .
docker build -f apps/web/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://dev.api.example.com \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/reward-web:$IMAGE_TAG .

docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/reward-api:$IMAGE_TAG
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/reward-worker:$IMAGE_TAG
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/reward-scheduler-py:$IMAGE_TAG
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/reward-web:$IMAGE_TAG
```

## 7.1 Run category-set normalization migration (existing data only)
If this environment contains data created before category-set enforcement, run:

```bash
cd /Users/lukexu/cs-projects/Relationship-Variable-Reward-Scheduler
corepack pnpm --filter @reward/api exec tsx ../../tools/migrations/normalize-category-sets.ts
```

## 8. Deploy to dev with Helm
```bash
aws eks update-kubeconfig --name $CLUSTER_DEV --region $AWS_REGION

helm upgrade --install relationship-reward deploy/helm/relationship-reward \
  --namespace $NAMESPACE_DEV \
  --create-namespace \
  --values deploy/helm/relationship-reward/values-dev.yaml \
  --set namespace=$NAMESPACE_DEV \
  --set web.image.repository=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/reward-web \
  --set web.image.tag=$IMAGE_TAG \
  --set web.env.VITE_API_BASE_URL=https://dev.api.example.com \
  --set api.image.repository=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/reward-api \
  --set api.image.tag=$IMAGE_TAG \
  --set api.env.CORS_ORIGINS=https://dev.app.example.com \
  --set worker.image.repository=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/reward-worker \
  --set worker.image.tag=$IMAGE_TAG \
  --set schedulerPy.image.repository=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/reward-scheduler-py \
  --set schedulerPy.image.tag=$IMAGE_TAG
```

## 9. Verify deployment
```bash
kubectl -n $NAMESPACE_DEV get pods
kubectl -n $NAMESPACE_DEV get svc
kubectl -n $NAMESPACE_DEV get externalsecret
kubectl -n $NAMESPACE_DEV logs deploy/api --tail=100
kubectl -n $NAMESPACE_DEV logs deploy/worker --tail=100
```

Health checks:
- API: `GET /healthz`
- Scheduler service: `GET /healthz`

## 10. Deploy to prod
Repeat steps 4-9 with:
- Cluster: `relationship-reward-prod`
- Namespace: `relationship-reward-prod`
- Helm values: `deploy/helm/relationship-reward/values-prod.yaml`
- Web build arg/API URL: production hosts

## 11. Rollback
```bash
helm -n $NAMESPACE_DEV history relationship-reward
helm -n $NAMESPACE_DEV rollback relationship-reward <REVISION>
```

## 12. Emergency cost shutdown
Scale workloads to zero:
```bash
kubectl -n $NAMESPACE_DEV scale deploy/api deploy/web deploy/worker deploy/scheduler-py --replicas=0
```

Delete dev namespace:
```bash
kubectl delete namespace $NAMESPACE_DEV
```

Delete dev cluster:
```bash
eksctl delete cluster --name $CLUSTER_DEV --region $AWS_REGION
```
