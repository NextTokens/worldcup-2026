'use client';

import { useActionState } from 'react';
import { loginAction } from '@/lib/actions/auth';
import { SubmitButton } from './SubmitButton';

export function LoginForm({ next }: { next: string }) {
  const [error, formAction] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="password">
          Passcode
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          className="field"
        />
      </div>
      {error ? <p className="text-sm text-brand">{error}</p> : null}
      <SubmitButton className="btn-primary w-full" pendingLabel="Checking…">
        Sign in
      </SubmitButton>
    </form>
  );
}
