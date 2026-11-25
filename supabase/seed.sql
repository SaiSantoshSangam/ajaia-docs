-- Ajaia Docs Seed Data
-- Creates 3 demo accounts (Alice, Bob, Carol), sample Tiptap JSONB documents,
-- and document_shares demonstrating Owner, Editor, and Viewer permissions.
--
-- Demo password for all 3 seeded accounts: AjaiaDemo123!
-- Override server-side via DEMO_USER_PASSWORD in .env.local if desired.

do $$
declare
  alice_id uuid := '10000000-0000-4000-8000-000000000001';
  bob_id   uuid := '10000000-0000-4000-8000-000000000002';
  carol_id uuid := '10000000-0000-4000-8000-000000000003';

  doc_arch_id      uuid := '20000000-0000-4000-8000-000000000001';
  doc_checklist_id uuid := '20000000-0000-4000-8000-000000000002';
  doc_eng_notes_id uuid := '20000000-0000-4000-8000-000000000003';
  doc_scratch_id   uuid := '20000000-0000-4000-8000-000000000004';

  pw_hash text;
begin
  perform set_config('search_path', 'public, extensions', true);
  pw_hash := crypt('AjaiaDemo123!', gen_salt('bf'));
  -- 1. Seed auth.users (triggers handle_new_user -> public.users)
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values
    (
      alice_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'alice@ajaia.demo',
      pw_hash,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Alice Morgan"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    ),
    (
      bob_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'bob@ajaia.demo',
      pw_hash,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Bob Chen"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    ),
    (
      carol_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'carol@ajaia.demo',
      pw_hash,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Carol Davis"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
  on conflict (id) do nothing;

  -- Seed auth.identities so email/password login works cleanly across Supabase versions
  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values
    (
      alice_id,
      alice_id,
      alice_id::text,
      jsonb_build_object('sub', alice_id::text, 'email', 'alice@ajaia.demo', 'email_verified', true, 'phone_verified', false),
      'email',
      now(),
      now(),
      now()
    ),
    (
      bob_id,
      bob_id,
      bob_id::text,
      jsonb_build_object('sub', bob_id::text, 'email', 'bob@ajaia.demo', 'email_verified', true, 'phone_verified', false),
      'email',
      now(),
      now(),
      now()
    ),
    (
      carol_id,
      carol_id,
      carol_id::text,
      jsonb_build_object('sub', carol_id::text, 'email', 'carol@ajaia.demo', 'email_verified', true, 'phone_verified', false),
      'email',
      now(),
      now(),
      now()
    )
  on conflict (id) do nothing;

  -- Ensure public.users records exist even if trigger was bypassed
  insert into public.users (id, email, full_name) values
    (alice_id, 'alice@ajaia.demo', 'Alice Morgan'),
    (bob_id,   'bob@ajaia.demo',   'Bob Chen'),
    (carol_id, 'carol@ajaia.demo', 'Carol Davis')
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name;

  -- 2. Seed rich Tiptap JSONB documents
  insert into public.documents (
    id,
    owner_id,
    title,
    content,
    content_text,
    is_public,
    public_role,
    share_token,
    source_type
  ) values
    (
      doc_arch_id,
      alice_id,
      'Ajaia Docs Architecture Overview',
      '{
        "type": "doc",
        "content": [
          {
            "type": "heading",
            "attrs": { "level": 1 },
            "content": [{ "type": "text", "text": "Ajaia Docs Architecture Overview" }]
          },
          {
            "type": "paragraph",
            "content": [
              { "type": "text", "text": "This document outlines our " },
              { "type": "text", "marks": [{ "type": "bold" }], "text": "PostgreSQL JSONB" },
              { "type": "text", "text": " persistence model and server-side authorization boundaries." }
            ]
          },
          {
            "type": "bulletList",
            "content": [
              {
                "type": "listItem",
                "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Alice is the document owner with full control." }] }]
              },
              {
                "type": "listItem",
                "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Bob has Editor access and can update content." }] }]
              },
              {
                "type": "listItem",
                "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Carol has Viewer access (read-only)." }] }]
              }
            ]
          }
        ]
      }'::jsonb,
      'Ajaia Docs Architecture Overview\nThis document outlines our PostgreSQL JSONB persistence model and server-side authorization boundaries.\nAlice is the document owner with full control.\nBob has Editor access and can update content.\nCarol has Viewer access (read-only).',
      false,
      'viewer',
      '30000000-0000-4000-8000-000000000001',
      'markdown'
    ),
    (
      doc_checklist_id,
      alice_id,
      'Product Launch Checklist',
      '{
        "type": "doc",
        "content": [
          {
            "type": "heading",
            "attrs": { "level": 1 },
            "content": [{ "type": "text", "text": "Product Launch Checklist" }]
          },
          {
            "type": "taskList",
            "content": [
              {
                "type": "taskItem",
                "attrs": { "checked": true },
                "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Configure Supabase RLS policies" }] }]
              },
              {
                "type": "taskItem",
                "attrs": { "checked": false },
                "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Review public share link permissions" }] }]
              }
            ]
          }
        ]
      }'::jsonb,
      'Product Launch Checklist\nConfigure Supabase RLS policies\nReview public share link permissions',
      true,
      'viewer',
      '30000000-0000-4000-8000-000000000002',
      'blank'
    ),
    (
      doc_eng_notes_id,
      bob_id,
      'Q4 Engineering Sprint Notes',
      '{
        "type": "doc",
        "content": [
          {
            "type": "heading",
            "attrs": { "level": 1 },
            "content": [{ "type": "text", "text": "Q4 Engineering Sprint Notes" }]
          },
          {
            "type": "paragraph",
            "content": [{ "type": "text", "text": "Owned by Bob and shared with Alice for read-only review." }]
          }
        ]
      }'::jsonb,
      'Q4 Engineering Sprint Notes\nOwned by Bob and shared with Alice for read-only review.',
      false,
      'viewer',
      '30000000-0000-4000-8000-000000000003',
      'txt'
    ),
    (
      doc_scratch_id,
      carol_id,
      'Carol Private Research Notes',
      '{
        "type": "doc",
        "content": [
          {
            "type": "heading",
            "attrs": { "level": 1 },
            "content": [{ "type": "text", "text": "Carol Private Research Notes" }]
          },
          {
            "type": "paragraph",
            "content": [{ "type": "text", "text": "Private document accessible only to Carol." }]
          }
        ]
      }'::jsonb,
      'Carol Private Research Notes\nPrivate document accessible only to Carol.',
      false,
      'viewer',
      '30000000-0000-4000-8000-000000000004',
      'blank'
    )
  on conflict (id) do nothing;

  -- 3. Seed document_shares
  insert into public.document_shares (
    document_id,
    shared_with_user_id,
    shared_with_email,
    role,
    created_by
  ) values
    (doc_arch_id, bob_id,   'bob@ajaia.demo',   'editor', alice_id),
    (doc_arch_id, carol_id, 'carol@ajaia.demo', 'viewer', alice_id),
    (doc_eng_notes_id, alice_id, 'alice@ajaia.demo', 'viewer', bob_id)
  on conflict (document_id, shared_with_email) do nothing;
end
$$;

