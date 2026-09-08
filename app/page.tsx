import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { getLang } from "@/lib/i18n";

// Nonce CSP (lib/csp.ts) hanya di-inject pada halaman yang di-render dinamis
// (docs resmi Next.js: nonces memerlukan dynamic rendering). Landing page
// ini murah untuk di-render per-request.
export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: "🧭",
    title: "Personal learning path",
    body: "Course → level → lesson → activity, with mastery-based unlocking, prerequisites, and a live level map that always tells students what to do next.",
  },
  {
    icon: "💻",
    title: "Coding-first content",
    body: "Structured articles written in Markdown, copy-ready code boards, and embedded PDF, audio, video, and file resources — plus a multi-language practice playground (Python, JavaScript, C++, Java, Go, Rust, and more) that runs code in a remote sandbox and shows real output.",
  },
  {
    icon: "⏱️",
    title: "Honest study time",
    body: "Active minutes come from clamped, server-validated heartbeats — not from an open tab. Weekly goals, spaced review, and next-best-action guidance keep learning on track.",
  },
  {
    icon: "📝",
    title: "Fair, server-side assessment",
    body: "Multiple choice, true/false, numeric, short text, essays, and projects — randomized pools, attempt limits, cooldowns, and timers. Scoring happens on the server; answer keys never reach the browser.",
  },
  {
    icon: "📊",
    title: "Insight for teachers",
    body: "Class overviews, mastery distributions, item analysis, misconception maps, and learning-path bottlenecks — every metric carries its definition, sample size, and last-updated time.",
  },
  {
    icon: "🎓",
    title: "Verifiable certificates",
    body: "Deterministic, tamper-evident PDF certificates (A4 landscape) with a QR code to a public, minimal-PII verifier — plus revocation, reissue, and optional chain anchoring behind a feature flag.",
  },
];

const AI_PATH = [
  {
    title: "Coding & computational thinking",
    body: "The first loop: structured lessons, copy-ready code, a multi-language practice runner, and honest study time build the habit of learning by doing.",
  },
  {
    title: "Data, logic & mathematics for ML",
    body: "Teachers compose the next rungs as versioned courses — statistics, linear algebra, and data reasoning — with server-graded quizzes and projects that require real mastery.",
  },
  {
    title: "Applied machine learning",
    body: "Structured ML pathways with rubrics, evidence-based grading, and certificate milestones — the same proven loop, applied to models instead of functions.",
  },
  {
    title: "Agentic AI & tool-using systems",
    body: "Agents, tools, memory, and evaluation become curriculum topics taught the same honest way: objectives, practice, assessment, and review — no hype, just verifiable progress.",
  },
  {
    title: "AGI literacy & responsible AI",
    body: "The final stage teaches students to reason about capabilities, limits, safety, and alignment — graduating with evidence of learning, not just claims about it.",
  },
];

const ROLES = [
  {
    eyebrow: "For students",
    title: "Learn at your own pace",
    body: "A personal dashboard, continue-where-you-left-off resume, lesson player with objectives and worked examples, honest progress tracking, and review that spaces out what you have learned.",
  },
  {
    eyebrow: "For teachers",
    title: "Teach with evidence",
    body: "Author and publish versioned courses, enroll cohorts, bulk-import students and content, grade fairly with rubrics, and act on analytics instead of guessing — no public student rankings.",
  },
  {
    eyebrow: "For guardians",
    title: "Stay informed, minimally",
    body: "Guardians linked by consent see a focused summary of their child’s progress and engagement — without answers, grades in detail, or personal data beyond what is needed.",
  },
];

export default async function HomePage() {
  const lang = await getLang();
  return (
    <main id="main" className="mx-auto max-w-5xl px-4 py-10">
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-extrabold text-white shadow-[var(--shadow-soft)]"
          >
            CS
          </span>
          <div>
            <p className="font-bold leading-tight">Coding School LMS</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">From first program to agentic AI</p>
          </div>
        </div>
        <ThemeToggle lang={lang} />
      </header>

      {/* Hero */}
      <section className="mt-12 text-center" aria-labelledby="hero-title">
        <p className="mx-auto inline-block rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
          Self-paced learning · teacher oversight · verifiable outcomes
        </p>
        <h1
          id="hero-title"
          className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-balance sm:text-5xl"
        >
          Learn to code at your own pace — with a teacher who can see the whole path.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Coding School LMS gives every student a personal learning journey, gives teachers evidence instead
          of guesswork, and issues certificates anyone can verify. Structured lessons, honest progress, and
          fair, server-side assessment — built for real classrooms. It is also the reliable base layer for an
          AI-era curriculum: every stage from a student&apos;s first <code>print()</code> to agentic AI,
          machine learning, and AGI literacy can run on the same loop of learning, practice, proof, and
          verifiable credentials.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-[var(--glow-btn)] transition hover:from-blue-700 hover:to-indigo-700"
          >
            Sign in
          </Link>
          <Link
            href="/learn"
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            Student demo
          </Link>
          <Link
            href="/teacher"
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            Teacher dashboard
          </Link>
          <Link
            href="/guardian"
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            Guardian view
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section aria-labelledby="features-title" className="mt-20">
        <p className="text-center text-sm font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">
          What the platform does
        </p>
        <h2 id="features-title" className="mt-2 text-center text-2xl font-bold tracking-tight">
          Designed for the full learning loop
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="card-lift rounded-2xl border bg-white p-5 shadow-[var(--shadow-soft)] dark:bg-slate-900"
            >
              <span aria-hidden="true" className="text-2xl">
                {f.icon}
              </span>
              <h3 className="mt-3 font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section aria-labelledby="roles-title" className="mt-20">
        <p className="text-center text-sm font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">
          Built for every role
        </p>
        <h2 id="roles-title" className="mt-2 text-center text-2xl font-bold tracking-tight">
          One platform, three clear views
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {ROLES.map((r) => (
            <article
              key={r.eyebrow}
              className="card-lift flex flex-col rounded-2xl border bg-white p-6 shadow-[var(--shadow-soft)] dark:bg-slate-900"
            >
              <p className="text-xs font-bold tracking-wide text-blue-700 uppercase dark:text-blue-300">
                {r.eyebrow}
              </p>
              <h3 className="mt-2 text-lg font-bold">{r.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{r.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* AI-era roadmap */}
      <section aria-labelledby="ai-path-title" className="mt-20">
        <p className="text-center text-sm font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">
          A platform for the AI era
        </p>
        <h2 id="ai-path-title" className="mt-2 text-center text-2xl font-bold tracking-tight">
          One honest loop, from first program to agentic AI &amp; AGI literacy
        </h2>
        <p className="mx-auto mt-3 max-w-3xl text-center text-slate-600 dark:text-slate-300">
          Coding School LMS does not promise to &ldquo;teach AI magic&rdquo;. It guarantees the discipline
          that makes an AI-era curriculum real: teachers compose each stage as courses, and the platform
          enforces honest practice, server-side proof, and verifiable credentials at every rung.
        </p>
        <ol className="mx-auto mt-8 max-w-3xl space-y-0">
          {AI_PATH.map((step, i) => {
            const last = i === AI_PATH.length - 1;
            return (
              <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
                {!last && (
                  <span
                    aria-hidden="true"
                    className="absolute top-10 left-[19px] h-[calc(100%-2rem)] w-0.5 bg-slate-200 dark:bg-slate-700"
                  />
                )}
                <span
                  aria-hidden="true"
                  className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-blue-600 bg-white font-bold text-blue-700 dark:bg-slate-900"
                >
                  {i + 1}
                </span>
                <div className="card-lift flex-1 rounded-2xl border bg-white p-4 shadow-[var(--shadow-soft)] dark:bg-slate-900">
                  <h3 className="font-bold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {step.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Trust & privacy */}
      <section
        aria-label="Security and privacy"
        className="card-lift mt-20 overflow-hidden rounded-2xl border bg-white shadow-[var(--shadow-soft)] dark:bg-slate-900"
      >
        <div aria-hidden="true" className="h-1.5 w-full bg-gradient-to-r from-blue-600 to-indigo-600" />
        <div className="p-6 sm:p-8">
          <p className="text-sm font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">
            Trusted by design
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">Secure by default, honest by measurement</h2>
          <ul className="mt-4 grid list-none gap-x-8 gap-y-2 text-sm text-slate-600 sm:grid-cols-2 dark:text-slate-300">
            <li className="flex gap-2">
              <span aria-hidden="true">🔐</span> Row-level security on every exposed table; roles never come
              from client metadata.
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true">🗝️</span> Keys and grading rules stay server-side — never shipped to
              the browser.
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true">📜</span> Append-only attempts and audit events for roles, membership,
              grades, and certificates.
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true">🔍</span> Public certificate verification exposes the minimum needed —
              no grades, no personal detail.
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true">♿</span> Accessible navigation, transcripts, reduced-motion support,
              and font scaling built in.
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true">🧱</span> No arbitrary HTML: lessons are sanitized structured blocks,
              so published content stays safe to embed.
            </li>
          </ul>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mt-16 text-center" aria-labelledby="cta-title">
        <h2 id="cta-title" className="text-2xl font-bold tracking-tight">
          Ready to see it in action?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-slate-600 dark:text-slate-300">
          Explore the demo roles below, or sign in with the account your school has provided.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-[var(--glow-btn)] transition hover:from-blue-700 hover:to-indigo-700"
          >
            Sign in
          </Link>
          <Link
            href="/catalog"
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            Browse the course catalog
          </Link>
        </div>
      </section>

      <footer className="mt-16 border-t border-slate-200 pt-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Coding School LMS — the honest learning loop underneath an AI-era pathway: coding → ML → agentic AI →
        AGI literacy.
      </footer>
    </main>
  );
}
