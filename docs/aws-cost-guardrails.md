# AWS Cost Guardrails (Bill-Shock Prevention)

This is a mandatory checklist for this project before any sustained AWS usage.

## 1. Hard spend controls (configure first)
1. Create monthly budget at account level.
2. Configure alerts at `50%`, `80%`, and `100%`.
3. Add an absolute emergency budget (for example `$250`) with immediate SNS/email alert.
4. Enable AWS Cost Anomaly Detection monitor.

Budget example:
```bash
aws budgets create-budget --account-id <ACCOUNT_ID> --budget '{
  "BudgetName":"relationship-reward-monthly",
  "BudgetLimit":{"Amount":"150","Unit":"USD"},
  "TimeUnit":"MONTHLY",
  "BudgetType":"COST"
}'
```

## 2. Biggest cost risks and required controls
- `EKS control plane`: one cluster per env costs continuously.  
Control: keep dev cluster off when not in use.
- `ALB`: hourly + LCU cost.  
Control: ingress disabled in dev by default.
- `NAT Gateway`: hourly + per-GB processing.  
Control: avoid NAT in dev when possible, use VPC endpoints.
- `CloudWatch Logs`: ingestion + storage growth.  
Control: retention limits (7d dev, 30d prod unless required).
- `Atlas`: fixed tier + backup retention.  
Control: smallest dev tier, strict retention.
- `ElastiCache`: always-on node charge.  
Control: smallest dev node (`cache.t4g.micro`) and dev-only uptime windows.

## 3. Baseline low-cost architecture defaults
- Dev EKS: `1 x t4g.small`, single AZ.
- Dev namespace replicas: 1 each (`api`, `web`, `worker`, `scheduler-py`).
- Dev ingress: disabled.
- Worker concurrency: conservative (`3` in dev).
- Resource requests/limits: always set (already in Helm values).

## 4. Logging and storage cost containment
Set log group retention (replace log group names as needed):
```bash
aws logs put-retention-policy --log-group-name "/aws/eks/relationship-reward-dev/api" --retention-in-days 7
aws logs put-retention-policy --log-group-name "/aws/eks/relationship-reward-dev/worker" --retention-in-days 7
aws logs put-retention-policy --log-group-name "/aws/eks/relationship-reward-prod/api" --retention-in-days 30
aws logs put-retention-policy --log-group-name "/aws/eks/relationship-reward-prod/worker" --retention-in-days 30
```

ECR lifecycle policy example (`ecr-lifecycle.json`):
```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep only latest 20 images",
      "selection": {
        "tagStatus": "any",
        "countType": "imageCountMoreThan",
        "countNumber": 20
      },
      "action": {"type": "expire"}
    }
  ]
}
```

```bash
aws ecr put-lifecycle-policy \
  --repository-name reward-api \
  --lifecycle-policy-text file://ecr-lifecycle.json
```

Repeat for all repos.

## 5. SES and reminder volume controls
- One email reminder per `eventId + reminderAt` (enforced with idempotency key).
- Track reminder count daily from `email_logs`.
- Alert when daily send volume exceeds expected threshold.

## 5.1 Schedule-generation queue volume controls
- Event/profile/settings/config mutations enqueue immediate `schedule-generation` jobs.
- Profile refresh jobs are deduped by `profile-refresh:<profileId>` to reduce duplicate queue growth.
- Monitor Redis/BullMQ queue depth and worker processing lag.
- Alert when queue depth or retry count grows unexpectedly (symptom of scheduler/worker issues).
- Track spikes from event-heavy write paths (event edit/delete/complete/miss + config/settings saves).
- In cost incidents, scale worker down before API/web only if delayed event generation is acceptable.

## 6. Networking cost controls
- Prefer one AZ in dev.
- Keep ALB off in dev except active test windows.
- Add VPC endpoints for `ecr.api`, `ecr.dkr`, `s3`, `logs` if NAT is required.

## 7. Operational cost runbook
Daily:
1. Check Cost Explorer grouped by service.
2. Verify no unexpected ALB, NAT, or EC2 spikes.

Weekly:
1. Confirm no orphan ALBs/EIPs/old nodegroups.
2. Clean stale namespaces and workloads.
3. Confirm CloudWatch retention is still enforced.

Monthly:
1. Execute dependency update workflow.
2. Prune ECR images.
3. Review Atlas/ElastiCache sizing against actual usage.
4. If event-config normalization migration is run, execute during low-traffic windows to avoid peak write bursts.

## 8. Emergency actions if spend spikes
1. Scale deployments to zero in dev immediately:
```bash
kubectl -n relationship-reward-dev scale deploy/api deploy/web deploy/worker deploy/scheduler-py --replicas=0
```
2. Disable ingress in dev:
```bash
helm upgrade --install relationship-reward deploy/helm/relationship-reward \
  --namespace relationship-reward-dev \
  --values deploy/helm/relationship-reward/values-dev.yaml \
  --set ingress.enabled=false
```
3. Delete dev cluster if idle:
```bash
eksctl delete cluster --name relationship-reward-dev --region us-east-1
```

## 9. Pre-prod cost signoff checklist
1. Budget + anomaly alerts verified.
2. Log retention policy verified.
3. Ingress need justified.
4. Replica and resource limits load-tested and right-sized.
5. NAT/VPC endpoint design reviewed.
6. Backup retention reviewed for Atlas and Redis.
