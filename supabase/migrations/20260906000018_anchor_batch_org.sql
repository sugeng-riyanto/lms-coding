-- Batch anchoring per-org (ADR-018): chain_anchors.organization_id memungkinkan
-- guru org meng-anchor HANYA sertifikat org-nya (authorization service-side,
-- tanpa cross-org leak). NULL = anchor ops/global (masa depan). Kolom non-PII
-- (hanya hash/root + tx reference tetap).

alter table public.chain_anchors
  add column organization_id uuid references public.organizations(id);

create index chain_anchors_org_idx on public.chain_anchors (organization_id);