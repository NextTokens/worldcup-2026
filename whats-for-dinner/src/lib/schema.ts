/**
 * Database DDL, kept in TypeScript so it ships inside the standalone Next.js
 * bundle (a stray .sql file would not be copied). Every statement is
 * idempotent: this is applied on boot and by `npm run db:push`.
 */
export const SCHEMA_SQL = `-- What's for Dinner — schema.
-- Applied idempotently at boot (and by \`npm run db:push\`), so it must stay
-- safe to re-run against a live database.

create table if not exists household (
  id                serial primary key,
  name              text        not null default 'Our family',
  servings          int         not null default 4,
  weeknight_minutes int         not null default 40,
  weekend_minutes   int         not null default 90,
  cuisines          text[]      not null default '{}',
  avoid             text[]      not null default '{}',
  no_repeat_days    int         not null default 10,
  budget            text        not null default 'medium',
  shopping_day      int,
  notes             text        not null default '',
  onboarded         boolean     not null default false,
  created_at        timestamptz not null default now()
);

create table if not exists member (
  id           serial primary key,
  household_id int     not null references household(id) on delete cascade,
  name         text    not null,
  is_cook      boolean not null default false,
  likes        text[]  not null default '{}',
  dislikes     text[]  not null default '{}',
  allergies    text[]  not null default '{}',
  diet         text    not null default '',
  notes        text    not null default '',
  sort_order   int     not null default 0
);

create table if not exists pantry_item (
  id           serial primary key,
  household_id int     not null references household(id) on delete cascade,
  name         text    not null,
  norm_name    text    not null,
  category     text    not null default 'other',
  quantity     numeric not null default 0,
  unit         text    not null default 'unit',
  par_level    numeric not null default 0,
  staple       boolean not null default false,
  use_by       date,
  note         text    not null default '',
  updated_at   timestamptz not null default now(),
  unique (household_id, norm_name)
);

create table if not exists dish (
  id             serial primary key,
  household_id   int     not null references household(id) on delete cascade,
  name           text    not null,
  norm_name      text    not null,
  cuisine        text    not null default '',
  tags           text[]  not null default '{}',
  effort_minutes int     not null default 40,
  servings       int     not null default 4,
  ingredients    jsonb   not null default '[]',
  steps          text[]  not null default '{}',
  notes          text    not null default '',
  source         text    not null default 'manual',
  favorite       boolean not null default false,
  active         boolean not null default true,
  times_cooked   int     not null default 0,
  last_cooked_at date,
  created_at     timestamptz not null default now(),
  unique (household_id, norm_name)
);

create table if not exists plan_entry (
  id           serial primary key,
  household_id int  not null references household(id) on delete cascade,
  plan_date    date not null,
  dish_id      int  references dish(id) on delete set null,
  dish_name    text not null,
  status       text not null default 'planned',
  reason       text not null default '',
  missing      jsonb not null default '[]',
  created_at   timestamptz not null default now(),
  cooked_at    timestamptz,
  unique (household_id, plan_date)
);

create table if not exists feedback (
  id            serial primary key,
  household_id  int not null references household(id) on delete cascade,
  plan_entry_id int not null references plan_entry(id) on delete cascade,
  member_id     int references member(id) on delete set null,
  rating        int not null,
  comment       text not null default '',
  created_at    timestamptz not null default now()
);

create table if not exists shopping_item (
  id           serial primary key,
  household_id int     not null references household(id) on delete cascade,
  name         text    not null,
  norm_name    text    not null,
  category     text    not null default 'other',
  quantity     numeric not null default 1,
  unit         text    not null default 'unit',
  status       text    not null default 'needed',
  reason       text    not null default '',
  source       text    not null default 'manual',
  created_at   timestamptz not null default now(),
  bought_at    timestamptz
);

-- One open line per item; bought history can repeat.
create unique index if not exists shopping_item_open_unique
  on shopping_item (household_id, norm_name)
  where status = 'needed';

create table if not exists suggestion_cache (
  household_id int  not null references household(id) on delete cascade,
  plan_date    date not null,
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  primary key (household_id, plan_date)
);

create index if not exists plan_entry_date_idx on plan_entry (household_id, plan_date desc);
create index if not exists dish_active_idx on dish (household_id, active);
create index if not exists pantry_category_idx on pantry_item (household_id, category);
`;
