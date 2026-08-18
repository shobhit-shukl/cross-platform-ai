const FAQS = [
  {
    q: 'Which platforms work right now?',
    a: 'YouTube is fully live — you can connect a channel and publish videos to it today. Instagram, LinkedIn, TikTok, Snapchat, X and Facebook are in progress and marked "Coming soon" above. We would rather show you honestly what is ready than promise integrations that are not.',
  },
  {
    q: 'Do you need my YouTube or Instagram password?',
    a: 'No, and we will never ask for one. Every connection goes through the platform’s own OAuth consent screen, where you sign in on their site and approve specific permissions. CrossPost AI never sees your password.',
  },
  {
    q: 'Is this scraping or browser automation?',
    a: 'No. Everything runs against the official APIs — for example, uploads use the YouTube Data API’s videos.insert endpoint. Nothing simulates a browser or works around a platform’s terms.',
  },
  {
    q: 'How are my account credentials stored?',
    a: 'Access and refresh tokens are encrypted at rest using AES-256-GCM and stay on the backend. They are never included in any response to your browser. Expired access tokens are refreshed automatically, so you do not have to reconnect constantly.',
  },
  {
    q: 'What permissions are you asking for?',
    a: 'The minimum needed for what you asked us to do. For YouTube that is read access to identify your channel, plus upload access to publish videos. We request nothing beyond that.',
  },
  {
    q: 'Can I disconnect an account later?',
    a: 'Yes, from the dashboard at any time. Disconnecting also revokes the token with the platform, so the access is genuinely withdrawn rather than just forgotten on our side.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 bg-white py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Questions, answered
          </h2>
        </div>

        <div className="mt-12 divide-y divide-slate-200 border-y border-slate-200">
          {FAQS.map((faq) => (
            // Native <details> keeps this a server component and is keyboard-accessible
            // without any JavaScript.
            <details key={faq.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
                {faq.q}
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </summary>
              <p className="mt-3 pr-9 text-sm leading-relaxed text-slate-600">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
