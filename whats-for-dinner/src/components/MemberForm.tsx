import { deleteMemberAction, saveMemberAction } from '@/lib/actions/family';
import type { Member } from '@/lib/types';
import { SubmitButton } from './SubmitButton';

/** One row per person. Likes and dislikes are what steer the suggestions. */
export function MemberForm({ member, index }: { member?: Member; index: number }) {
  // Several of these render on one page alongside other forms, so ids are scoped.
  const id = member?.id ? `member-${member.id}` : 'member-new';

  return (
    <form action={saveMemberAction} className="card space-y-3">
      {member?.id ? <input type="hidden" name="id" value={member.id} /> : null}
      <input type="hidden" name="sortOrder" value={member?.sortOrder ?? index} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${id}-name`}>
            Name
          </label>
          <input id={`${id}-name`} name="name" defaultValue={member?.name ?? ''} required className="field" />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-diet`}>
            Diet
          </label>
          <input
            id={`${id}-diet`}
            name="diet"
            defaultValue={member?.diet ?? ''}
            placeholder="vegetarian, halal, low carb"
            className="field"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor={`${id}-likes`}>
            Likes
          </label>
          <input
            id={`${id}-likes`}
            name="likes"
            defaultValue={member?.likes.join(', ') ?? ''}
            placeholder="rice, grilled chicken"
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-dislikes`}>
            Dislikes
          </label>
          <input
            id={`${id}-dislikes`}
            name="dislikes"
            defaultValue={member?.dislikes.join(', ') ?? ''}
            placeholder="mushrooms"
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-allergies`}>
            Allergies
          </label>
          <input
            id={`${id}-allergies`}
            name="allergies"
            defaultValue={member?.allergies.join(', ') ?? ''}
            placeholder="peanuts"
            className="field"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isCook" defaultChecked={member?.isCook ?? false} className="size-4" />
          Does the cooking
        </label>
        <SubmitButton className="btn-ghost ml-auto">{member?.id ? 'Save' : 'Add person'}</SubmitButton>
      </div>
    </form>
  );
}

export function DeleteMemberButton({ member }: { member: Member }) {
  return (
    <form action={deleteMemberAction}>
      <input type="hidden" name="id" value={member.id} />
      <SubmitButton className="btn-quiet" confirm={`Remove ${member.name}?`}>
        Remove
      </SubmitButton>
    </form>
  );
}
