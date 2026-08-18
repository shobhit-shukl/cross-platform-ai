import { AuthCta } from './auth-cta';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Soft radial wash behind the headline; purely decorative. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-gradient-to-b from-slate-100 via-white to-white"
      />

      <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          YouTube publishing is live
        </span>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
          Publish once. Everywhere your audience is.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
          CrossPost AI connects your social accounts through their official APIs, then
          takes one video and publishes it across every platform — with AI writing the
          titles, descriptions and captions for each one.
        </p>

        <div className="mt-9 flex justify-center">
          <AuthCta variant="hero" />
        </div>

        <p className="mt-5 text-xs text-slate-500">
          Free to start · Official OAuth · We never ask for your platform password
        </p>
      </div>
    </section>
  );
}
