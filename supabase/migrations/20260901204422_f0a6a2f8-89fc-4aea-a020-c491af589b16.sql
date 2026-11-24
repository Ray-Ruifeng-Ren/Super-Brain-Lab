CREATE TABLE public.zz_export_auth_users AS SELECT * FROM auth.users;
CREATE TABLE public.zz_export_auth_identities AS SELECT * FROM auth.identities;
GRANT SELECT ON public.zz_export_auth_users TO service_role;
GRANT SELECT ON public.zz_export_auth_identities TO service_role;
ALTER TABLE public.zz_export_auth_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zz_export_auth_identities ENABLE ROW LEVEL SECURITY;