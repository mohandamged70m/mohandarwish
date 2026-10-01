-- Verify the Trails ingest after applying dashboard-schema.sql.
-- Read-only apart from one self-test row, which it creates and then removes.
-- Run in the Supabase SQL Editor after a few real visits have been recorded.
--
-- Each block prints the value plus what it should be, so you can eyeball it.
-- (Written for the SQL Editor, not psql: no \echo, no backslash commands.)

-- ── 1. dash_merge: numbers add, nested objects merge, other values are set ──
-- expect a=3, m.x=15, m.y=2, s='new', only=1
select public.dash_merge(
  '{"a":1,"m":{"x":10,"y":2},"s":"keep"}'::jsonb,
  '{"a":2,"m":{"x":5},"s":"new","only":1}'::jsonb
) as merged_expect_a3_mx15_y2_s_new_only1;

-- ── 2. dash_patch_seq applies seq 1, then refuses the same seq again ──
-- first  -> expect a row with Flushes 1, Seq 1
-- replay -> expect null (that is the whole point: counted once)
select public.dash_patch_seq('Analytics/_selftest', '{"Flushes":1}'::jsonb, 1, '[]'::jsonb) as first_expect_row;
select public.dash_patch_seq('Analytics/_selftest', '{"Flushes":1}'::jsonb, 1, '[]'::jsonb) as replay_expect_null;

-- ── 3. a higher seq advances and appends events ──
select public.dash_patch_seq('Analytics/_selftest', '{"Flushes":1}'::jsonb, 2,
  '[{"t":1,"k":"section","v":"hero"}]'::jsonb) is not null as seq2_applied_expect_true;

-- expect Seq 2, Flushes 2, Events length 1
select
  data->>'Seq'                                   as seq_expect_2,
  data->>'Flushes'                               as flushes_expect_2,
  jsonb_array_length(coalesce(data->'Events','[]'::jsonb)) as events_expect_1
from dashboard_docs where path = 'Analytics/_selftest';

-- ── 4. per-visit invariants ──
-- Link-only mode: every recorded visit must carry a share-link code.
-- expect 0
select count(*) as visits_without_a_link_expect_0
from dashboard_docs
where path like 'Analytics/Sessions/Items/%'
  and coalesce(data->'Link'->>'Id', '') = '';

-- The sequence can only ever have been applied in order, so the flush counter can
-- never exceed it. expect 0
select count(*) as flushes_above_seq_expect_0
from dashboard_docs
where path like 'Analytics/Sessions/Items/%'
  and coalesce((data->>'Flushes')::int, 0) > coalesce((data->>'Seq')::int, 0);

-- Social counters are one row per network, stored canonically.
-- dashboard_docs has no id column: the network name is the last segment of the path.
-- expect no rows (GitHub not Github, LinkedIn not Linkedin)
select substring(path from '[^/]+$') as network
from dashboard_docs
where path like 'Analytics/Socials/Items/%'
  and (
    lower(substring(path from '[^/]+$'))
      in ('github','linkedin','instagram','facebook','twitter','youtube','tiktok')
    and substring(path from '[^/]+$')
      not in ('GitHub','LinkedIn','Instagram','Facebook','Twitter','YouTube','TikTok')
  )
order by network;

-- ── 5. rollups agree with the stories they came from ──
-- Days must add up to Totals for sessions and visitors.
select
  (select coalesce(sum((data->>'Sessions')::int), 0) from dashboard_docs
     where path like 'Analytics/Days/Items/%')                              as sessions_from_days,
  (select coalesce((data->>'Sessions')::int, 0) from dashboard_docs
     where path = 'Analytics/Totals')                                      as sessions_on_totals,
  (select coalesce(sum((data->>'Visitors')::int), 0) from dashboard_docs
     where path like 'Analytics/Days/Items/%')                              as visitors_from_days,
  (select coalesce((data->>'Visitors')::int, 0) from dashboard_docs
     where path = 'Analytics/Totals')                                      as visitors_on_totals;

-- Link opens: one per non-owner visit that carried a link.
-- expect these to match
select
  (select count(*) from dashboard_docs
     where path like 'Analytics/Sessions/Items/%'
       and not coalesce((data->>'Owner')::boolean, false)
       and coalesce(data->'Link'->>'Id', '') <> '')                      as visits_with_link,
  (select coalesce((data->>'LinkOpens')::int, 0) from dashboard_docs
     where path = 'Analytics/Totals')                                      as link_opens_on_totals;

-- Owner visits ARE recorded (so the tab has its own row) but must never be counted.
-- expect a small number: only your own testing, and none of it in the totals above.
select count(*) as owner_visits_recorded_expect_only_your_own
from dashboard_docs
where path like 'Analytics/Sessions/Items/%'
  and coalesce((data->>'Owner')::boolean, false);

-- A source row per origin, each with the kind the dashboard colours by.
select data->>'Kind' as kind, count(*) as rows, sum((data->>'Sessions')::int) as visits
from dashboard_docs
where path like 'Analytics/Sources/Items/%'
group by data->>'Kind'
order by visits desc;

-- ── clean up the self-test row ──
delete from dashboard_docs where path = 'Analytics/_selftest';