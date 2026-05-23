export default function HomePage() {
  return (
    <main className="flex items-center justify-center px-6 py-16">
      <section className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white/90 p-10 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]" />
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">Status</p>
        </div>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950">ReviewDNA is active</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          Configure GitHub webhooks to point at <span className="font-medium text-slate-900">/api/webhook</span> and
          the bot will review pull requests automatically.
        </p>
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-700">
          Webhook URL: <span className="font-mono text-slate-900">/api/webhook</span>
        </div>
      </section>
    </main>
  );
}
