-- Grant PostgREST schema, table, and function privileges to anon and authenticated roles.
-- Run this in your Supabase SQL Editor if queries return PostgreSQL error 42501
-- ("permission denied for table documents"). RLS policies still govern row-level access.

grant usage on schema public to anon, authenticated;
grant select on public.documents to anon;
grant select, insert, update, delete on public.users, public.documents, public.document_shares to authenticated;
grant execute on function public.is_document_owner(uuid, uuid) to authenticated;
grant execute on function public.has_document_access(uuid, uuid, text) to anon, authenticated;

