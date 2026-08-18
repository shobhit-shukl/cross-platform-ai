import { LoginForm } from '@/components/login-form';

/**
 * Server component on purpose: reading `?mode=register` here means the form renders in
 * the right mode in the very first HTML, with no flash and no Suspense boundary. Using
 * the client-side `useSearchParams()` hook instead would opt this route out of static
 * rendering unless wrapped in <Suspense>.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return <LoginForm initialMode={mode === 'register' ? 'register' : 'login'} />;
}
