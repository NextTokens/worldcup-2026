'use server';

import { redirect } from 'next/navigation';
import { checkPassword, signIn, signOut } from '@/lib/auth';

export async function loginAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/') || '/';

  if (!checkPassword(password)) return 'That passcode does not match.';

  await signIn();
  redirect(next.startsWith('/') ? next : '/');
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect('/login');
}
