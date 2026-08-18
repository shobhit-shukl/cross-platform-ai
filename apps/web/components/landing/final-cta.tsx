import { AuthCta } from './auth-cta';

export function FinalCta() {
  return (
    <section className="bg-slate-900 py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Stop uploading the same video five times
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-300">
          Connect your YouTube channel and publish your first video in a couple of
          minutes. More platforms are on the way.
        </p>

        <div className="mt-9 flex justify-center">
          <AuthCta variant="hero" tone="dark" />
        </div>
      </div>
    </section>
  );
}
