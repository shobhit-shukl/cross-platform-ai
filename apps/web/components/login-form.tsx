'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useAnimationControls } from 'motion/react';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { ApiError, login, register } from '@/lib/api';
import { scaleIn, spring } from '@/lib/motion';

export function LoginForm({ initialMode = 'login' }: { initialMode?: 'login' | 'register' }) {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const cardControls = useAnimationControls();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      cardControls.start({ x: [0, -10, 10, -7, 7, -3, 3, 0], transition: { duration: 0.5 } });
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'mt-1 w-full rounded-md border border-border-strong bg-white/[0.03] px-3 py-2 text-sm text-ink transition focus:border-brand-violet focus:outline-none focus:ring-2 focus:ring-brand-violet/30';

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4">
      <AnimatedBackground intensity="high" />

      <motion.div initial="hidden" animate="visible" variants={scaleIn} className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-ink-faint transition hover:text-ink-soft"
        >
          ← Back to home
        </Link>

        <motion.div
          animate={cardControls}
          className="rounded-xl border border-border-strong bg-surface/80 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <h1 className="bg-brand-gradient bg-clip-text text-xl font-semibold text-transparent">
            CrossPost AI
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink-soft">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink-soft">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-sm text-rose-400"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              type="submit"
              disabled={submitting}
              whileTap={{ scale: 0.97 }}
              transition={spring}
              className="w-full rounded-md bg-brand-gradient px-3 py-2 text-sm font-medium text-white shadow-[0_0_24px_-6px_rgba(139,92,246,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </motion.button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="mt-4 w-full text-center text-sm text-ink-faint transition hover:text-ink-soft"
          >
            {mode === 'login'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </motion.div>
      </motion.div>
    </main>
  );
}
