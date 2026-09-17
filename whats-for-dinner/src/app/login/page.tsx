import { redirect } from 'next/navigation';
import { isSignedIn, passwordRequired } from '@/lib/auth';
import { LoginForm } from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (!passwordRequired() || (await isSignedIn())) redirect('/');
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <div className="card">
        <div className="mb-4 text-center">
          <p aria-hidden className="text-4xl">
            🍲
          </p>
          <h1 className="mt-2 text-xl font-bold tracking-tight">What&rsquo;s for Dinner</h1>
          <p className="mt-1 text-sm text-ink-soft">Enter the family passcode.</p>
        </div>
        <LoginForm next={next ?? '/'} />
      </div>
    </main>
  );
}
