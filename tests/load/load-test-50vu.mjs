#!/usr/bin/env node
/**
 * Load Test: 50 concurrent VUs against the LMS
 * 
 * Tests:
 * 1. Landing page (unauthenticated)
 * 2. Health endpoint
 * 3. Catalog page (unauthenticated)
 * 4. Login → Dashboard (authenticated)
 * 5. Certificate verify (public)
 *
 * Usage: node tests/load/load-test-50vu.mjs
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:49947";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://jspmxdzgxevtfwvldwxy.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const STUDENT_EMAIL = process.env.STUDENT_EMAIL || "murid01@demo.local";
const STUDENT_PASSWORD = process.env.STUDENT_PASSWORD || "PhysDemo-2026!";
const VUS = parseInt(process.env.VUS || "50", 10);
const DURATION_MS = parseInt(process.env.DURATION_MS || "30000", 10); // 30s

const results = {
  landing: { ok: 0, fail: 0, latencies: [] },
  health: { ok: 0, fail: 0, latencies: [] },
  catalog: { ok: 0, fail: 0, latencies: [] },
  login: { ok: 0, fail: 0, latencies: [] },
  dashboard: { ok: 0, fail: 0, latencies: [] },
  verify: { ok: 0, fail: 0, latencies: [] },
};

async function timedFetch(url, opts = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, opts);
    const ms = performance.now() - start;
    return { status: res.status, ms, ok: res.ok };
  } catch (err) {
    const ms = performance.now() - start;
    return { status: 0, ms, ok: false, error: err.message };
  }
}

async function login() {
  const res = await timedFetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD }),
    }
  );
  if (res.ok) {
    results.login.ok++;
  } else {
    results.login.fail++;
  }
  results.login.latencies.push(res.ms);
  return res.ok;
}

async function vuWorkload() {
  // 1. Landing page
  const landing = await timedFetch(`${BASE_URL}/`);
  if (landing.ok) results.landing.ok++; else results.landing.fail++;
  results.landing.latencies.push(landing.ms);

  // 2. Health
  const health = await timedFetch(`${BASE_URL}/api/health`);
  if (health.ok) results.health.ok++; else results.health.fail++;
  results.health.latencies.push(health.ms);

  // 3. Catalog
  const catalog = await timedFetch(`${BASE_URL}/catalog`);
  if (catalog.ok) results.catalog.ok++; else results.catalog.fail++;
  results.catalog.latencies.push(catalog.ms);

  // 4. Login
  const loggedIn = await login();

  // 5. Dashboard (if logged in)
  if (loggedIn) {
    const dash = await timedFetch(`${BASE_URL}/learn`);
    if (dash.ok) results.dashboard.ok++; else results.dashboard.fail++;
    results.dashboard.latencies.push(dash.ms);
  }

  // 6. Certificate verify
  const verify = await timedFetch(`${BASE_URL}/api/public/certificates/demo-valid-certificate`);
  if (verify.ok) results.verify.ok++; else results.verify.fail++;
  results.verify.latencies.push(verify.ms);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function printResults() {
  console.log("\n" + "=".repeat(70));
  console.log(`  LOAD TEST RESULTS — ${VUS} VUs, ${DURATION_MS / 1000}s duration`);
  console.log("=".repeat(70));
  console.log(
    `  ${"Endpoint".padEnd(15)} ${"OK".padStart(6)} ${"Fail".padStart(6)} ${"p50".padStart(8)} ${"p95".padStart(8)} ${"p99".padStart(8)} ${"max".padStart(8)}`
  );
  console.log("-".repeat(70));

  for (const [name, data] of Object.entries(results)) {
    const sorted = [...data.latencies].sort((a, b) => a - b);
    const total = data.ok + data.fail;
    if (total === 0) continue;
    const p50 = percentile(sorted, 50).toFixed(0);
    const p95 = percentile(sorted, 95).toFixed(0);
    const p99 = percentile(sorted, 99).toFixed(0);
    const max = (sorted[sorted.length - 1] || 0).toFixed(0);
    console.log(
      `  ${name.padEnd(15)} ${String(data.ok).padStart(6)} ${String(data.fail).padStart(6)} ${(p50 + "ms").padStart(8)} ${(p95 + "ms").padStart(8)} ${(p99 + "ms").padStart(8)} ${(max + "ms").padStart(8)}`
    );
  }

  console.log("-".repeat(70));
  let totalOk = 0, totalFail = 0;
  for (const d of Object.values(results)) {
    totalOk += d.ok;
    totalFail += d.fail;
  }
  const errorRate = totalOk + totalFail > 0 ? ((totalFail / (totalOk + totalFail)) * 100).toFixed(2) : "0";
  console.log(`  TOTAL: ${totalOk} ok, ${totalFail} fail, error rate: ${errorRate}%`);
  console.log("=".repeat(70));

  // Threshold checks
  const allLatencies = Object.values(results).flatMap(d => d.latencies);
  const allSorted = [...allLatencies].sort((a, b) => a - b);
  const globalP95 = percentile(allSorted, 95);
  const globalP99 = percentile(allSorted, 99);
  
  console.log("\n  THRESHOLD CHECKS:");
  console.log(`  p95 < 500ms: ${globalP95 < 500 ? "✅ PASS" : "❌ FAIL"} (${globalP95.toFixed(0)}ms)`);
  console.log(`  p99 < 1000ms: ${globalP99 < 1000 ? "✅ PASS" : "❌ FAIL"} (${globalP99.toFixed(0)}ms)`);
  console.log(`  error rate < 1%: ${parseFloat(errorRate) < 1 ? "✅ PASS" : "❌ FAIL"} (${errorRate}%)`);
  
  const passed = globalP95 < 500 && globalP99 < 1000 && parseFloat(errorRate) < 1;
  console.log(`\n  OVERALL: ${passed ? "✅ ALL THRESHOLDS PASS" : "❌ THRESHOLD VIOLATION"}`);
}

async function main() {
  console.log(`Starting load test: ${VUS} VUs for ${DURATION_MS / 1000}s`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Student: ${STUDENT_EMAIL}\n`);

  // First login to check credentials
  const loginOk = await login();
  if (!loginOk) {
    console.error("❌ Login failed — check credentials. Aborting load test.");
    process.exit(1);
  }
  // Reset login count for clean report
  results.login.ok = 0;
  results.login.fail = 0;
  results.login.latencies = [];

  // Ramp up and run
  const workers = [];
  const endTime = Date.now() + DURATION_MS;
  let activeVUs = 0;

  // Start VUs
  for (let i = 0; i < VUS; i++) {
    activeVUs++;
    workers.push(
      (async () => {
        while (Date.now() < endTime) {
          await vuWorkload();
          // Small random delay to simulate think time
          await new Promise(r => setTimeout(r, 50 + Math.random() * 200));
        }
        activeVUs--;
      })()
    );
  }

  await Promise.all(workers);
  printResults();
}

main().catch((err) => {
  console.error("Load test crashed:", err);
  process.exit(1);
});
