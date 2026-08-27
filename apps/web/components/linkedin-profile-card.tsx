'use client';

import { motion } from 'motion/react';
import { fadeUp } from '@/lib/motion';
import type { LinkedInProfile } from '@/lib/types';

export function LinkedInProfileCard({ profile }: { profile: LinkedInProfile }) {
  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      className="flex items-center gap-4 rounded-xl border border-border bg-surface/60 p-6 backdrop-blur"
    >
      {profile.pictureUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.pictureUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0A66C2] text-xl font-semibold text-white">
          {profile.name?.charAt(0) ?? 'in'}
        </div>
      )}
      <div>
        <p className="text-base font-semibold text-ink">{profile.name ?? 'LinkedIn member'}</p>
        {profile.email && <p className="text-sm text-ink-soft">{profile.email}</p>}
        <p className="mt-1 text-xs text-ink-faint">Member ID: {profile.memberId}</p>
      </div>
    </motion.section>
  );
}
