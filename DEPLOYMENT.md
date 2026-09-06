# Deployment and Operations

## Environments

- Local: local Supabase + seeded anonymous data.
- Preview: isolated database/project; no production student data.
- Production: protected branch and reviewed migrations.

## Environment variables

```text
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
CERTIFICATE_SIGNING_SECRET=
BLOCKCHAIN_ANCHOR_ENABLED=false
BLOCKCHAIN_PROVIDER=
BLOCKCHAIN_NETWORK=
```

Secret variables hanya tersedia server-side. Gunakan key model terbaru yang direkomendasikan provider; jangan hard-code.

## Release

1. Backup/restore point.
2. Review migration and RLS tests.
3. Deploy preview and run E2E.
4. Apply production migration melalui workflow resmi.
5. Deploy application.
6. Smoke test login, submit, dashboard, PDF, verifier.
7. Monitor error, latency, job queue, dan auth failures.

## Runbooks wajib

- compromised teacher account;
- accidental grade change;
- failed certificate generation;
- stuck job queue;
- database restore;
- revoke exposed secret;
- privacy/data correction request.

