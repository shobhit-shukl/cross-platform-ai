'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { fadeUp, revealOnScroll, smooth } from '@/lib/motion';

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
  // Native <details> can't animate height without JS, so this is one of the few
  // interactive-state components in the landing tree — button + aria-expanded is the
  // standard accessible pattern for a JS-driven accordion.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <motion.div {...revealOnScroll} variants={fadeUp} className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink">Questions, answered</h2>
        </motion.div>

        <div className="mt-12 divide-y divide-border border-y border-border">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={faq.q} className="py-5">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 text-left text-base font-medium text-ink"
                >
                  {faq.q}
                  <motion.svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5 shrink-0 text-ink-faint"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    aria-hidden
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={smooth}
                  >
                    <path d="M12 5v14M5 12h14" />
                  </motion.svg>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={smooth}
                      className="overflow-hidden"
                    >
                      <p className="mt-3 pr-9 text-sm leading-relaxed text-ink-soft">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
