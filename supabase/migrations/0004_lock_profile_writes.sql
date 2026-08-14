-- Close the self-serve-Pro hole: 0001's "own profile" policy was `for all`,
-- so a signed-in user could PATCH their own row via PostgREST with the anon
-- key — including setting plan='pro' without paying. The app only ever READS
-- profiles as the user (getSession in src/lib/auth.ts); every legitimate
-- write comes from the Stripe webhook (service role, bypasses RLS) or the
-- auth triggers (security definer, run as the function owner). Neither is
-- affected by this migration.
drop policy "own profile" on profiles;
create policy "own profile" on profiles for select using (auth.uid() = id);

-- Belt and braces: RLS only filters rows for roles that hold the underlying
-- table privilege, so drop client-role write privileges entirely.
revoke insert, update, delete on table profiles from anon, authenticated;
