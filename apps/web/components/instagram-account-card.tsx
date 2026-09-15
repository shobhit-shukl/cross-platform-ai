'use client';

import { motion } from 'motion/react';
import { fadeUp } from '@/lib/motion';
import type { SocialAccount } from '@/lib/types';

export function InstagramAccountCard({ account }: { account: SocialAccount }) {
  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      className="flex items-center gap-4 rounded-xl border border-border bg-surface/60 p-6 backdrop-blur"
    >
      {account.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={account.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#4F5BD5] text-xl font-semibold text-white">
          {account.displayName?.charAt(0) ?? 'ig'}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-ink">
          {account.displayName ? `@${account.displayName.replace(/^@/, '')}` : 'Instagram account'}
        </p>
        <p className="mt-1 text-xs text-ink-faint">Posting to this account</p>
      </div>
    </motion.section>
  );
}
