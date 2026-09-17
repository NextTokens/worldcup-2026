/** Shown when DATABASE_URL is missing — the only hard requirement. */
export function Setup() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Almost there</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        This app stores your family&rsquo;s pantry, dishes and plans in Postgres, and no database is attached yet.
      </p>
      <ol className="mt-4 list-inside list-decimal space-y-2 text-sm">
        <li>
          In Railway, add a <strong>Postgres</strong> database to this project.
        </li>
        <li>
          Reference it from this service so <code className="rounded bg-surface-2 px-1">DATABASE_URL</code> is set.
        </li>
        <li>Redeploy. The tables are created automatically on first request.</li>
      </ol>
      <p className="mt-4 text-xs text-ink-soft">
        Running locally? Put <code className="rounded bg-surface-2 px-1">DATABASE_URL</code> in
        <code className="ml-1 rounded bg-surface-2 px-1">.env.local</code>.
      </p>
    </main>
  );
}
