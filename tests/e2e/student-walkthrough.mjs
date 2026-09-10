#!/usr/bin/env node
/**
 * Full student E2E walkthrough — uses client-side link clicks (not goto).
 * Captures screenshots at every step.
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:49947";
const EMAIL = "murid01@demo.local";
const PASSWORD = "PhysDemo-2026!";
const DIR = ".freebuff/e2e-walkthrough";

mkdirSync(DIR, { recursive: true });

let stepNum = 0;
async function snap(page, name) {
  stepNum++;
  const path = join(DIR, `${String(stepNum).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`  📸 ${path}`);
}

async function clickNavLink(page, pattern) {
  // Dismiss any open panels first
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  const link = page.getByRole("link", { name: pattern }).first();
  if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
    await link.click();
    await page.waitForTimeout(3000);
    return true;
  }
  // Fallback: nav link by href
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

  // Suppress noisy request failures
  page.on("requestfailed", () => {});

  console.log("═══════════════════════════════════════════════════════");
  console.log("  STUDENT E2E WALKTHROUGH — murid01@demo.local");
  console.log("═══════════════════════════════════════════════════════");

  // ── 1: Landing ──────────────────────────────────────
  console.log("\n📍 1 — Landing page");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(3000);
  const hero = await page.textContent("h1").catch(() => "N/A");
  console.log(`  Hero: "${hero}"`);
  await snap(page, "landing");

  // ── 2: Login ────────────────────────────────────────
  console.log("\n📍 2 — Sign in as murid01");
  const signInLink = page.getByRole("link", { name: /sign in/i }).first();
  await signInLink.click();
  await page.waitForTimeout(2000);
  await snap(page, "login-page");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await snap(page, "login-filled");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/learn", { timeout: 20_000 });
  console.log(`  ✅ Redirected to: ${page.url()}`);
  await page.waitForTimeout(3000);
  await snap(page, "learn-dashboard");

  // ── 3: Catalog (via nav link) ──────────────────────
  console.log("\n📍 3 — Browse catalog");
  const clicked = await clickNavLink(page, /catalog/i);
  if (clicked) {
    console.log(`  ✅ Navigated to: ${page.url()}`);
    await snap(page, "catalog");
    const headings = await page.locator("h2, h3").allTextContents();
    console.log(`  Headings: ${headings.slice(0, 8).join(" | ")}`);

    // Look for enroll buttons
    const enrollBtns = await page.getByRole("button", { name: /enroll|join|masuk|mulai/i }).all();
    if (enrollBtns.length > 0) {
      console.log(`  Found ${enrollBtns.length} enroll button(s) — clicking first...`);
      await enrollBtns[0].click();
      await page.waitForTimeout(3000);
      await snap(page, "enrolled");
    }
  } else {
    console.log("  ⚠️ Could not find catalog link in nav");
  }

  // ── 4: Learn / Level Map (via nav link) ────────────
  console.log("\n📍 4 — Learn page — progress & level map");
  if (await clickNavLink(page, /learn/i)) {
    console.log(`  ✅ URL: ${page.url()}`);
    await snap(page, "learn-levels");

    // Check for lesson links
    const learnLinks = await page.locator("a[href*='/learn/']").all();
    const linkHrefs = [];
    for (const l of learnLinks.slice(0, 10)) {
      const href = await l.getAttribute("href");
      if (href && !linkHrefs.includes(href)) linkHrefs.push(href);
    }
    console.log(`  Lesson links: ${linkHrefs.slice(0, 5).join(" | ")}`);
  }

  // ── 5: Open a lesson/activity ──────────────────────
  console.log("\n📍 5 — Open a lesson");
  const lessonLinks = await page.locator("a[href*='/learn/']").all();
  if (lessonLinks.length > 0) {
    const href = await lessonLinks[0].getAttribute("href");
    if (href) {
      console.log(`  Opening: ${href}`);
      await lessonLinks[0].click();
      await page.waitForTimeout(4000);
      await snap(page, "lesson");
      const title = await page.locator("h1, h2").first().textContent().catch(() => "N/A");
      console.log(`  Title: "${title}"`);

      // Look for activity links within lesson
      const actLinks = await page.locator("a[href*='/activities/']").all();
      if (actLinks.length > 0) {
        console.log(`  Found ${actLinks.length} activity link(s) — clicking first...`);
        await actLinks[0].click();
        await page.waitForTimeout(4000);
        await snap(page, "activity");
        const actTitle = await page.locator("h1, h2").first().textContent().catch(() => "N/A");
        console.log(`  Activity: "${actTitle}"`);
      }
    }
  }

  // ── 6: Quiz ────────────────────────────────────────
  console.log("\n📍 6 — Quiz / Assessment");
  // Look for quiz links on current page
  let quizFound = false;
  const quizLinks = await page.locator("a[href*='/quiz/'], a[href*='/attempts/']").all();
  if (quizLinks.length > 0) {
    const href = await quizLinks[0].getAttribute("href");
    if (href) {
      console.log(`  Opening quiz: ${href}`);
      await quizLinks[0].click();
      await page.waitForTimeout(4000);
      await snap(page, "quiz");
      quizFound = true;
    }
  }
  if (!quizFound) {
    // Go back to catalog and try
    console.log("  Going to catalog to find quiz...");
    if (await clickNavLink(page, /catalog/i)) {
      await page.waitForTimeout(2000);
      const qLinks = await page.locator("a[href*='/quiz/'], a[href*='/attempts/']").all();
      if (qLinks.length > 0) {
        await qLinks[0].click();
        await page.waitForTimeout(4000);
        await snap(page, "quiz-from-catalog");
      } else {
        console.log("  No quiz links found on catalog");
      }
    }
  }

  // ── 7: Certificates ────────────────────────────────
  console.log("\n📍 7 — Certificates");
  if (await clickNavLink(page, /certific/i)) {
    console.log(`  ✅ URL: ${page.url()}`);
    await snap(page, "certificates");
    const certText = await page.locator("main, [role='main']").first().textContent().catch(() => "");
    console.log(`  Content preview: ${certText.substring(0, 300).replace(/\s+/g, " ")}...`);
  }

  // ── 8: Review Queue ────────────────────────────────
  console.log("\n📍 8 — Review queue (spaced repetition)");
  if (await clickNavLink(page, /review/i)) {
    console.log(`  ✅ URL: ${page.url()}`);
    await snap(page, "review-queue");
    const reviewText = await page.locator("main, [role='main']").first().textContent().catch(() => "");
    console.log(`  Content: ${reviewText.substring(0, 200).replace(/\s+/g, " ")}...`);
  }

  // ── 9: Analytics ───────────────────────────────────
  console.log("\n📍 9 — Analytics");
  if (await clickNavLink(page, /analytic/i)) {
    console.log(`  ✅ URL: ${page.url()}`);
    await snap(page, "analytics");
  }

  // ── 10: Profile ────────────────────────────────────
  console.log("\n📍 10 — Profile/Settings");
  if (await clickNavLink(page, /profile|setting/i)) {
    console.log(`  ✅ URL: ${page.url()}`);
    await snap(page, "profile");
  }

  // ── Summary ────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`  WALKTHROUGH COMPLETE — ${stepNum} screenshots in ${DIR}/`);
  console.log("═══════════════════════════════════════════════════════");

  await browser.close();
}

main().catch((err) => {
  console.error("❌ Walkthrough failed:", err);
  process.exit(1);
});
