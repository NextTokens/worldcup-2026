import { AppShell } from '@/components/AppShell';
import { HouseholdForm } from '@/components/HouseholdForm';
import { DeleteMemberButton, MemberForm } from '@/components/MemberForm';
import { Setup } from '@/components/Setup';
import { requirePage } from '@/lib/auth';
import { databaseConfigured } from '@/lib/db';
import { getHousehold, listMembers } from '@/lib/repo/household';

export const dynamic = 'force-dynamic';

export default async function FamilyPage() {
  await requirePage('/family');
  if (!databaseConfigured()) return <Setup />;

  const household = await getHousehold();
  const members = await listMembers(household.id);

  return (
    <AppShell householdName={household.name}>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Your family</h1>
      <p className="mb-4 text-sm text-ink-soft">
        The more honest this page is, the better tonight&rsquo;s suggestion will be.
      </p>

      <div className="space-y-4">
        <HouseholdForm household={household} />

        <section>
          <h2 className="section-title mb-2">Who eats</h2>
          <div className="space-y-3">
            {members.map((m, i) => (
              <div key={m.id}>
                <MemberForm member={m} index={i} />
                <div className="mt-1 flex justify-end">
                  <DeleteMemberButton member={m} />
                </div>
              </div>
            ))}
            {/* Keyed on the count so it remounts empty after each person is added. */}
            <MemberForm key={`new-${members.length}`} index={members.length} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
