-- Trails atomic-write functions.
--
-- Run this FIRST, on its own, before verify-trails.sql. It is separate from
-- dashboard-schema.sql so a failure anywhere else cannot leave these uncreated —
-- without them /api/track silently falls back to in-process merge, which loses
-- counts whenever two flushes land at once.
--
-- Safe to re-run: every statement is create-or-replace or idempotent.

-- ── dash_merge: the rule ──────────────────────────────────────────────
-- Everything else in this project reads a document, adds to it in JavaScript and
-- writes it back. That is fine for the dashboard — one person, editing one thing at a
-- time. It is not fine for analytics: /api/track is public and concurrent, so two
-- flushes arriving together would each read the same pre-write total and one count
-- would vanish. These functions do the read-modify-write inside one statement, which
-- is what Firestore's FieldValue.increment() did before the Supabase port.
--
--   key only in base   -> kept as-is
--   number + number    -> added        (counters)
--   object  + object   -> merged recursively (Countries / Devices maps)
--   anything else      -> overwritten   (state: exit section, last open time)
--
-- The `base || <patch keys>` shape is the load-bearing part: the result must be a
-- superset of base. Iterating jsonb_object_keys(patch) alone returns ONLY the keys the
-- patch mentions, which silently deletes every other field in the document — a rollup
-- of {Sessions:1} would erase Visitors, Contacts and the rest, and a link's counters
-- would take its Code, Name and Tailor with them.
create or replace function public.dash_merge(base jsonb, patch jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(base, '{}'::jsonb) || coalesce(
    (
      select jsonb_object_agg(
        k,
        case
          when jsonb_typeof(base -> k) = 'object'
           and jsonb_typeof(patch -> k) = 'object'
            then public.dash_merge(base -> k, patch -> k)
          when jsonb_typeof(base -> k) = 'number'
           and jsonb_typeof(patch -> k) = 'number'
            then to_jsonb((base ->> k)::numeric + (patch ->> k)::numeric)
          else patch -> k
        end
      )
      from jsonb_object_keys(patch) as k
    ),
    '{}'::jsonb
  );
$$;

-- ── dash_patch: upsert + merge in one call. Returns the stored document.
create or replace function public.dash_patch(p_path text, p_patch jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_data jsonb;
begin
  insert into dashboard_docs as d (path, data, updated_at)
  values (p_path, coalesce(p_patch, '{}'::jsonb), now())
  on conflict (path) do update
    set data = public.dash_merge(d.data, coalesce(p_patch, '{}'::jsonb)),
        updated_at = now()
  returning data into v_data;

  return v_data;
end;
$$;

-- ── dash_patch_seq: apply a flush exactly once ────────────────────────
-- The whole visit-recording design rests on one number. Each flush carries `seq`,
-- counting up from 1, and the server must apply it once and only once: a retry, a
-- reload that restarts the same visit, and two flushes racing over a flaky connection
-- all have to land on the same answer.
--
-- So the sequence check and the write happen in one statement, under a row lock:
--   stored Seq >= p_max_seq  ->  return null, and the caller treats it as a replay
-- The caller re-reads and recomputes on null, because its view of Events and Scroll
-- was stale by definition — which is why state fields may be sent as plain sets here.
--
-- p_patch goes through dash_merge (counters add, nested maps merge, state sets).
-- p_events is appended to the timeline rather than merged.
create or replace function public.dash_patch_seq(
  p_path text,
  p_patch jsonb,
  p_max_seq int,
  p_events jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_data jsonb;
  v_next jsonb;
begin
  select data into v_data from dashboard_docs where path = p_path for update;
  if not found then
    v_data := '{}'::jsonb;
  end if;

  if coalesce((v_data ->> 'Seq')::int, 0) >= p_max_seq then
    return null;   -- replay or out-of-order: already applied, never twice
  end if;

  v_next :=
    public.dash_merge(
      jsonb_set(v_data, '{Seq}', to_jsonb(p_max_seq)),
      coalesce(p_patch, '{}'::jsonb)
    )
    || jsonb_build_object(
         'Events',
         coalesce(v_data -> 'Events', '[]'::jsonb) || coalesce(p_events, '[]'::jsonb)
       );

  insert into dashboard_docs as d (path, data, updated_at)
  values (p_path, v_next, now())
  on conflict (path) do update
    set data = v_next,
        updated_at = now()
  returning data into v_data;

  return v_data;
end;
$$;

-- ── confirm all three exist ───────────────────────────────────────────
-- expect three rows.
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('dash_merge', 'dash_patch', 'dash_patch_seq')
order by p.proname;