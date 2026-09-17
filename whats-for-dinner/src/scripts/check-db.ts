/**
 * Integration check for the data layer.
 *
 * Runs every repository function against a real Postgres and asserts the
 * round-trips: `npm run check:db` against a SCRATCH database (it writes data,
 * so never point it at the family's real one). Unit tests cover the pure
 * logic; this is what catches SQL and serialisation mistakes.
 */
import { getHousehold, updateHousehold, listMembers, upsertMember } from '@/lib/repo/household';
import { listPantry, upsertPantryItem, consumeIngredients } from '@/lib/repo/pantry';
import { saveDish, listDishes, markCooked, dishRatings } from '@/lib/repo/dishes';
import { setPlanEntry, getPlanEntry, setPlanStatus, addFeedback, listFeedback, recentPlan, listPlanRange, writeSuggestionCache, readSuggestionCache } from '@/lib/repo/plan';
import { addShoppingItem, addProposed, listShopping, setShoppingStatus, boughtItems, clearBought } from '@/lib/repo/shopping';
import { buildShoppingList } from '@/lib/suggest/shopping';
import { rankDishes } from '@/lib/suggest/score';
import { getSql } from '@/lib/db';

const ok = (label: string, cond: unknown) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) process.exitCode = 1;
};

const h = await getHousehold();
await updateHousehold(h.id, { name: 'The Alis', servings: 5, cuisines: ['levantine'], avoid: ['pork'], onboarded: true });
const h2 = await getHousehold();
ok('household upsert + update', h2.name === 'The Alis' && h2.servings === 5 && h2.avoid[0] === 'pork' && h2.onboarded);

await upsertMember(h.id, { name: 'Lina', likes: ['rice'], allergies: ['peanut'] });
await upsertMember(h.id, { name: 'Omar', dislikes: ['mushroom'], isCook: true });
const members = await listMembers(h.id);
ok('members', members.length === 2 && members.some((m) => m.allergies[0] === 'peanut'));

await upsertMember(h.id, { id: members[0].id, name: 'Lina', likes: ['rice', 'chicken'], allergies: ['peanut'] });
ok('member update in place', (await listMembers(h.id)).length === 2);

await upsertPantryItem(h.id, { name: 'Basmati Rice', quantity: 2, unit: 'kg', category: 'grains', staple: true, parLevel: 1 });
await upsertPantryItem(h.id, { name: 'rice', quantity: 1, unit: 'kg', mode: 'add' });   // same shelf
await upsertPantryItem(h.id, { name: 'Chicken thighs', quantity: 900, unit: 'g', category: 'meat' });
await upsertPantryItem(h.id, { name: 'Tomatoes', quantity: 6, unit: 'unit', category: 'produce', useBy: '2026-09-18' });
await upsertPantryItem(h.id, { name: 'Milk', quantity: 0, unit: 'l', category: 'dairy', staple: true, parLevel: 3 });
const pantry = await listPantry(h.id);
ok('pantry rows kept distinct by canonical name', pantry.length === 5);
ok('pantry add-mode accumulates', pantry.find((p) => p.normName === 'rice')?.quantity === 1);

const dishId = await saveDish(h.id, {
  name: 'Chicken and rice',
  cuisine: 'levantine',
  effortMinutes: 45,
  ingredients: [
    { name: 'chicken thighs', quantity: 800, unit: 'g', optional: false },
    { name: 'basmati rice', quantity: 500, unit: 'g', optional: false },
    { name: 'yogurt', quantity: 200, unit: 'g', optional: true },
  ],
  steps: ['Brown the chicken', 'Add rice and stock', 'Cover and cook'],
});
await saveDish(h.id, {
  name: 'Peanut satay',
  ingredients: [{ name: 'peanut butter', quantity: 3, unit: 'tbsp', optional: false }],
});
await saveDish(h.id, {
  name: 'Tomato pasta',
  effortMinutes: 25,
  ingredients: [
    { name: 'pasta', quantity: 500, unit: 'g', optional: false },
    { name: 'tomatoes', quantity: 4, unit: 'unit', optional: false },
  ],
});
const dishes = await listDishes(h.id);
ok('dishes saved', dishes.length === 3 && dishId !== null);

const ranked = rankDishes(dishes, { household: h2, members, pantry, date: '2026-09-16', ratings: {} });
ok('allergen dish excluded from ranking', !ranked.some((r) => r.dish.name === 'Peanut satay'));
ok('fully covered dish ranks first', ranked[0]?.dish.name === 'Chicken and rice');
ok('coverage computed', ranked[0].coverage === 1 && ranked[0].missing.length === 0);
const pastaRank = ranked.find((r) => r.dish.name === 'Tomato pasta')!;
ok('partial coverage reports the gap', pastaRank.missing.map((m) => m.name).join() === 'Pasta');
ok('use-soon surfaced', pastaRank.usesSoon.includes('Tomatoes'));

const entryId = await setPlanEntry(h.id, { date: '2026-09-16', dishId, dishName: 'Chicken and rice', reason: 'Everything is in', missing: [] });
ok('plan entry created', entryId > 0);
await setPlanEntry(h.id, { date: '2026-09-16', dishId, dishName: 'Chicken and rice', reason: 'changed', missing: [] });
ok('plan entry is upsert-by-date', (await listPlanRange(h.id, '2026-09-16', '2026-09-16')).length === 1);

await setPlanStatus(h.id, '2026-09-16', 'cooked');
await markCooked(h.id, dishId!, '2026-09-16');
const emptied = await consumeIngredients(h.id, [
  { name: 'chicken thighs', quantity: 800, unit: 'g' },
  { name: 'basmati rice', quantity: 500, unit: 'g' },
]);
const after = await listPlanRange(h.id, '2026-09-16', '2026-09-16');
ok('status recorded', after[0].status === 'cooked' && after[0].cookedAt !== null);
const pantryAfter = await listPantry(h.id);
ok('pantry deducted', pantryAfter.find((p) => p.normName === 'chicken thigh')?.quantity === 100);
ok('rice not deducted across units', pantryAfter.find((p) => p.normName === 'basmati rice')?.quantity === 2);
ok('nothing wrongly emptied', emptied.length === 0);
ok('cook count incremented', (await listDishes(h.id)).find((d) => d.id === dishId)?.timesCooked === 1);

await addFeedback(h.id, entryId, members[0].id, 5, 'Lina loved it');
await addFeedback(h.id, entryId, null, 4, '');
ok('feedback stored', (await listFeedback(h.id, entryId)).length === 2);
ok('ratings aggregate', (await dishRatings(h.id))[dishId!] === 4.5);
ok('avg rating on dish row', (await listDishes(h.id)).find((d) => d.id === dishId)?.avgRating === 4.5);
ok('history reads back', (await recentPlan(h.id)).length >= 1);

await writeSuggestionCache(h.id, '2026-09-16', { date: '2026-09-16', generatedBy: 'local', note: 'n', options: [] });
ok('suggestion cache round-trips', (await readSuggestionCache(h.id, '2026-09-16'))?.note === 'n');

const proposed = buildShoppingList({
  pantry: pantryAfter,
  plannedDishes: [{ dish: (await listDishes(h.id)).find((d) => d.name === 'Tomato pasta')!, date: '2026-09-19' }],
  existing: [],
});
const added = await addProposed(h.id, proposed);
ok('shopping list built', added === proposed.length && proposed.length > 0);
ok('out-of-stock staple included', proposed.some((p) => p.normName === 'milk'));
ok('planned gap included', proposed.some((p) => p.normName === 'pasta'));
ok('re-running adds nothing new', (await addProposed(h.id, proposed)) === 0);

await addShoppingItem(h.id, { name: 'Kitchen roll', quantity: 2 });
await addShoppingItem(h.id, { name: 'kitchen rolls', quantity: 3 });   // same item
const list = await listShopping(h.id);
ok('manual add dedupes by canonical name', list.filter((i) => i.normName === 'kitchen roll').length === 1);
ok('quantity takes the larger', list.find((i) => i.normName === 'kitchen roll')?.quantity === 3);

const milk = list.find((i) => i.normName === 'milk')!;
await setShoppingStatus(h.id, milk.id, 'bought');
ok('marked bought', (await boughtItems(h.id)).length === 1);
for (const b of await boughtItems(h.id)) {
  await upsertPantryItem(h.id, { name: b.name, quantity: b.quantity, unit: b.unit, category: b.category, mode: 'add' });
}
await clearBought(h.id);
ok('put away restocks pantry', (await listPantry(h.id)).find((p) => p.normName === 'milk')!.quantity === 3);
ok('bought line cleared', (await boughtItems(h.id)).length === 0);
ok('milk can be re-added after being cleared', (await (async () => { await addShoppingItem(h.id, { name: 'Milk' }); return listShopping(h.id); })()).some((i) => i.normName === 'milk'));

await getSql().end();
console.log(process.exitCode ? '\nFAILURES' : '\nall good');
