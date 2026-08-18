const STEPS = [
  {
    title: 'Connect your accounts',
    body: 'Sign in to each platform through its official consent screen. You approve exactly what CrossPost AI can do, and you can disconnect at any time.',
  },
  {
    title: 'Upload once',
    body: 'Pick your video, add a title and description, choose who can see it. Let AI draft the metadata or write it yourself.',
  },
  {
    title: 'Publish everywhere',
    body: 'We push it to every connected account and track each upload through to a published post — with the link and post ID saved for you.',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-y border-slate-200 bg-slate-50/60 py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Three steps, then it&apos;s automatic
          </h2>
          <p className="mt-4 text-slate-600">
            Connect once. After that, publishing everywhere is a single upload.
          </p>
        </div>

        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative rounded-xl border border-slate-200 bg-white p-7 shadow-sm"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
