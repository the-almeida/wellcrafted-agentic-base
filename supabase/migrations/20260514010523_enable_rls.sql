-- Defense-in-depth ownership policies. The backend uses the service role
-- key (which bypasses RLS), so these policies fire only if a future caller
-- ever connects under the `authenticated` role. Business logic stays in the
-- app layer (per-module Policy in domain/policy.ts).

ALTER TABLE public.example_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_example_entities_select" ON public.example_entities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_own_example_entities_modify" ON public.example_entities
  FOR ALL USING (auth.uid() = user_id);
