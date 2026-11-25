-- Ajaia Docs Initial Schema & Row Level Security
-- Tables:
--   1. public.users
--   2. public.documents (Tiptap rich-text stored as JSONB)
--   3. public.document_shares

create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. Users (synced with Supabase auth.users)
-- =============================================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_email on public.users(lower(email));

alter table public.users enable row level security;

-- =============================================================================
-- 2. Documents (Tiptap JSONB content + sharing metadata)
-- =============================================================================
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  title text not null default 'Untitled Document',
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  content_text text not null default '',
  is_public boolean not null default false,
  public_role text not null default 'viewer' check (public_role in ('viewer', 'editor')),
  share_token uuid not null unique default gen_random_uuid(),
  source_type text not null default 'blank' check (source_type in ('blank', 'markdown', 'txt')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_owner_id on public.documents(owner_id);
create index if not exists idx_documents_updated_at on public.documents(updated_at desc);
create index if not exists idx_documents_share_token on public.documents(share_token);

alter table public.documents enable row level security;

-- =============================================================================
-- 3. Document Shares (per-user / per-email permissions)
-- =============================================================================
create table if not exists public.document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  shared_with_user_id uuid references public.users(id) on delete cascade,
  shared_with_email text not null,
  role text not null default 'viewer' check (role in ('viewer', 'editor')),
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_document_share_email unique (document_id, shared_with_email)
);

create index if not exists idx_document_shares_document_id on public.document_shares(document_id);
create index if not exists idx_document_shares_user_id on public.document_shares(shared_with_user_id);
create index if not exists idx_document_shares_email on public.document_shares(lower(shared_with_email));

alter table public.document_shares enable row level security;

-- =============================================================================
-- 4. Updated_at triggers
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

drop trigger if exists trg_document_shares_updated_at on public.document_shares;
create trigger trg_document_shares_updated_at
  before update on public.document_shares
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 5. Sync auth.users -> public.users & link pending email shares
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_email text;
  user_name text;
begin
  user_email := lower(coalesce(new.email, ''));
  user_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(user_email, '@', 1)
  );

  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    user_email,
    user_name,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.users.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url);

  update public.document_shares
  set shared_with_user_id = new.id
  where lower(shared_with_email) = user_email
    and shared_with_user_id is null;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- 6. Authorization Helper Functions (SECURITY DEFINER to avoid RLS recursion)
-- =============================================================================
create or replace function public.is_document_owner(doc_id uuid, uid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.documents d
    where d.id = doc_id and d.owner_id = uid
  );
$$;

create or replace function public.has_document_access(doc_id uuid, uid uuid, required_role text default 'viewer')
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.documents d
    where d.id = doc_id
      and (
        d.owner_id = uid
        or (
          required_role = 'viewer' and d.is_public = true
        )
        or (
          required_role = 'editor' and d.is_public = true and d.public_role = 'editor'
        )
        or exists (
          select 1
          from public.document_shares s
          join public.users u on u.id = uid
          where s.document_id = d.id
            and (s.shared_with_user_id = uid or lower(s.shared_with_email) = lower(u.email))
            and (
              required_role = 'viewer'
              or (required_role = 'editor' and s.role = 'editor')
            )
        )
      )
  );
$$;

-- =============================================================================
-- 7. Row Level Security Policies
-- =============================================================================

-- Users
create policy "Users are viewable by authenticated users"
  on public.users for select
  to authenticated
  using (true);

create policy "Users can update own record"
  on public.users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Documents
create policy "Users can read accessible documents"
  on public.documents for select
  using (
    owner_id = auth.uid()
    or is_public = true
    or (auth.uid() is not null and public.has_document_access(id, auth.uid(), 'viewer'))
  );

create policy "Authenticated users can create own documents"
  on public.documents for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners and editors can update documents"
  on public.documents for update
  to authenticated
  using (public.has_document_access(id, auth.uid(), 'editor'))
  with check (public.has_document_access(id, auth.uid(), 'editor'));

create policy "Only owners can delete documents"
  on public.documents for delete
  to authenticated
  using (owner_id = auth.uid());

-- Document shares
create policy "Owners and recipients can view document shares"
  on public.document_shares for select
  to authenticated
  using (
    public.is_document_owner(document_id, auth.uid())
    or shared_with_user_id = auth.uid()
    or lower(shared_with_email) = lower(coalesce((select email from public.users where id = auth.uid()), ''))
  );

create policy "Only owners can create document shares"
  on public.document_shares for insert
  to authenticated
  with check (
    public.is_document_owner(document_id, auth.uid())
    and created_by = auth.uid()
  );

create policy "Only owners can update document shares"
  on public.document_shares for update
  to authenticated
  using (public.is_document_owner(document_id, auth.uid()))
  with check (public.is_document_owner(document_id, auth.uid()));

create policy "Only owners can delete document shares"
  on public.document_shares for delete
  to authenticated
  using (public.is_document_owner(document_id, auth.uid()));

-- =============================================================================
-- 8. Table & Function Privileges for PostgREST (anon & authenticated roles)
-- =============================================================================
grant usage on schema public to anon, authenticated;
grant select on public.documents to anon;
grant select, insert, update, delete on public.users, public.documents, public.document_shares to authenticated;
grant execute on function public.is_document_owner(uuid, uuid) to authenticated;
grant execute on function public.has_document_access(uuid, uuid, text) to anon, authenticated;
