/**
 * CSP alert notification — env-gated webhook for spike ACTIVE transitions.
 * No new infrastructure: uses native fetch() to POST to a configured URL.
 * Activated when CSP_ALERT_WEBHOOK_URL is set; silent otherwise.
 *
 * Notification payload is aggregate-only (no URIs, no PII).
 */

interface CspNotifyPayload {
  event: "ACTIVE" | "CLEARED";
  ratePerMin: number;
  thresholdPerMin: number;
  violationsPerMin: number;
  blockedPerMin: number;
  sampleSize: number;
  total: number;
  timestamp: string;
}

/**
 * Fire a webhook notification for a CSP alert state transition.
 * Silent if CSP_ALERT_WEBHOOK_URL is not configured.
 * Fire-and-forget: errors are logged but never thrown (alerting must not break the report path).
 */
export async function notifyCspSpike(payload: CspNotifyPayload): Promise<void> {
  const url = process.env.CSP_ALERT_WEBHOOK_URL;
  if (!url) return; // Not configured — silent no-op.

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "lms-csp-alerting",
        ...payload,
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      console.error(`[csp-notify] webhook returned ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error("[csp-notify] webhook failed:", err instanceof Error ? err.message : err);
  }
}
