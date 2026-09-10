#!/usr/bin/env node
/**
 * Guardian (wali) E2E walkthrough with screenshots.
 * Verifies: child progress, quiz scores, study time, certificate downloads.
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:49947";
const EMAIL = "wali@demo.local";
const PASSWORD = "PhysDemo-2026!";
const DIR = ".freebuff/e2e-walkthrough-guardian";

mkdirSync(DIR, { recursive: true });

let stepNum = 0;
async function snap(page, name) {
  stepNum++;
  const path = join(DIR, `${String(stepNum).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`  📸 ${path}`);
}

async function clickNavLink(page, pattern) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const link = page.getByRole("link", { name: pattern }).first();
  if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
    await link.click();
    await page.waitForTimeout(3000);
    return true;
  }
  const navLink = page.locator(`nav a[href*="${pattern}"], a[href*="${pattern}"]`).first();
  if (await navLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await navLink.click();
    await page.waitForTimeout(3000);
    return true;
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("requestfailed", () => {});

  console.log("═══════════════════════════════════════════════════════");
  console.log("  GUARDIAN E2E WALKTHROUGH — wali@demo.local");
  console.log("═══════════════════════════════════════════════════════");

  // ── 1: Login ────────────────────────────────────────
  console.log("\n📍 1 — Sign in as wali@demo.local");
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(2000);
  await snap(page, "login-page");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await snap(page, "login-filled");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Guardian should redirect to /guardian
  try {
    await page.waitForURL("**/guardian**", { timeout: 20_000 });
    console.log(`  ✅ Redirected to: ${page.url()}`);
  } catch {
    console.log(`  ⚠️ Current URL: ${page.url()} (may not be /guardian)`);
  }
  await page.waitForTimeout(3000);
  await snap(page, "guardian-dashboard");

  // ── 2: Check dashboard content ──────────────────────
  console.log("\n📍 2 — Guardian dashboard content");
  const mainContent = await page.locator("main, [role='main']").first().textContent().catch(() => "");
  console.log(`  Content preview: ${mainContent.substring(0, 400).replace(/\s+/g, " ")}...`);

  // Look for child names
  const childNames = await page.locator("text=murid01, text=Murid 01, text=b0000000").allTextContents();
  console.log(`  Child references: ${childNames.slice(0, 5).join(" | ")}`);

  // Look for progress indicators
  const progressBars = await page.locator("[role='progressbar'], [class*='progress'], [class*='Progress']").count();
  console.log(`  Progress indicators: ${progressBars}`);

  // Look for percentage values
  const percentages = await page.locator("text=/\\d+%/").allTextContents();
  console.log(`  Percentage values: ${percentages.slice(0, 10).join(" | ")}`);

  // ── 3: Check for quiz scores ────────────────────────
  console.log("\n📍 3 — Quiz scores visibility");
  const quizKeywords = ["quiz", "score", "grade", "nilai", "skor", "assessment", "penilaian"];
  const quizElements = [];
  for (const kw of quizKeywords) {
    const els = await page.locator(`text=/${kw}/i`).count();
    if (els > 0) quizElements.push(`${kw}: ${els}`);
  }
  console.log(`  Quiz-related elements: ${quizElements.join(", ") || "none found"}`);

  // ── 4: Check for study time ─────────────────────────
  console.log("\n📍 4 — Study time visibility");
  const timeKeywords = ["time", "hour", "minute", "duration", "waktu", "jam", "menit", "study"];
  const timeElements = [];
  for (const kw of timeKeywords) {
    const els = await page.locator(`text=/${kw}/i`).count();
    if (els > 0) timeElements.push(`${kw}: ${els}`);
  }
  console.log(`  Time-related elements: ${timeElements.join(", ") || "none found"}`);

  // ── 5: Check for certificates ──────────────────────
  console.log("\n📍 5 — Certificate links");
  const certLinks = await page.locator("a[href*='certific'], a[href*='pdf'], button:has-text('PDF'), button:has-text('Download'), button:has-text('Unduh')").all();
  console.log(`  Certificate download links: ${certLinks.length}`);
  for (const l of certLinks.slice(0, 5)) {
    const text = await l.textContent().catch(() => "");
    const href = await l.getAttribute("href").catch(() => "");
    console.log(`    - "${text.trim()}" → ${href || "(button)"}`);
  }

  // ── 6: Navigate to certificates page ───────────────
  console.log("\n📍 6 — Certificates page");
  if (await clickNavLink(page, /certific/i)) {
    console.log(`  ✅ URL: ${page.url()}`);
    await snap(page, "certificates");
    const certContent = await page.locator("main, [role='main']").first().textContent().catch(() => "");
    console.log(`  Content: ${certContent.substring(0, 300).replace(/\s+/g, " ")}...`);
  } else {
    // Try navigating directly
    await page.goto(`${BASE}/certificates`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(3000);
    await snap(page, "certificates-direct");
  }

  // ── 7: Back to guardian dashboard for full view ─────
  console.log("\n📍 7 — Full guardian dashboard view");
  await page.goto(`${BASE}/guardian`, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await snap(page, "guardian-full");

  // ── 8: Try other guardian nav links ─────────────────
  console.log("\n📍 8 — Explore other guardian views");
  const allNavLinks = await page.locator("nav a").all();
  const navTexts = [];
  for (const l of allNavLinks) {
    const text = (await l.textContent().catch(() => "")).trim();
    const href = await l.getAttribute("href").catch(() => "");
    if (text && href) navTexts.push(`${text} → ${href}`);
  }
  console.log(`  Nav links: ${navTexts.join(" | ")}`);

  // ── Summary ────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`  GUARDIAN WALKTHROUGH COMPLETE — ${stepNum} screenshots in ${DIR}/`);
  console.log("═══════════════════════════════════════════════════════");

  await browser.close();
}

main().catch((err) => {
  console.error("❌ Guardian walkthrough failed:", err);
  process.exit(1);
});
