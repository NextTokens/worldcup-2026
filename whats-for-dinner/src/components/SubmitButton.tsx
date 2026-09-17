'use client';

import { useFormStatus } from 'react-dom';

/**
 * Submit button that disables itself while the action runs. Several actions
 * here call OpenAI and take a few seconds, so the pending state matters.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className = 'btn-primary',
  title,
  confirm,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  title?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      title={title}
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
