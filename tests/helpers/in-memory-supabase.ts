import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentRow, DocumentShareRow, UserRow } from "@/types/database";

export const TEST_ALICE = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "alice@ajaia.demo",
  fullName: "Alice Morgan",
};

export const TEST_BOB = {
  id: "10000000-0000-4000-8000-000000000002",
  email: "bob@ajaia.demo",
  fullName: "Bob Chen",
};

export const TEST_CAROL = {
  id: "10000000-0000-4000-8000-000000000003",
  email: "carol@ajaia.demo",
  fullName: "Carol Davis",
};

/**
 * Stateful in-memory Supabase client test double implementing query-builder methods
 * across users, documents (JSONB), and document_shares tables.
 */
export function createInMemorySupabase(getAuthUser?: () => { id: string; email: string } | null) {
  const users: UserRow[] = [TEST_ALICE, TEST_BOB, TEST_CAROL].map((u) => ({
    id: u.id,
    email: u.email,
    full_name: u.fullName,
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const documents: DocumentRow[] = [];
  const documentShares: DocumentShareRow[] = [];

  function hydrateRow(
    table: string,
    row: Record<string, unknown>
  ): Record<string, unknown> {
    if (table === "documents") {
      const owner = users.find((u) => u.id === row.owner_id) ?? null;
      return { ...row, owner };
    }
    if (table === "document_shares") {
      const recipient =
        users.find((u) => u.id === row.shared_with_user_id) ?? null;
      return { ...row, recipient };
    }
    return { ...row };
  }

  function makeBuilder(table: "users" | "documents" | "document_shares") {
    const getStore = (): Record<string, unknown>[] => {
      if (table === "users") return users as unknown as Record<string, unknown>[];
      if (table === "documents")
        return documents as unknown as Record<string, unknown>[];
      return documentShares as unknown as Record<string, unknown>[];
    };

    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let action: "select" | "insert" | "upsert" | "update" | "delete" = "select";
    let payload: Record<string, unknown> | null = null;
    let orderCol: string | null = null;
    let orderAsc = true;

    const execute = async () => {
      const store = getStore();
      const matches = () => store.filter((row) => filters.every((fn) => fn(row)));

      if (action === "insert" && payload) {
        const now = new Date().toISOString();
        const created: Record<string, unknown> = {
          id: crypto.randomUUID(),
          is_public: false,
          public_role: "viewer",
          share_token: crypto.randomUUID(),
          created_at: now,
          updated_at: now,
          ...payload,
        };
        store.push(created);
        return { data: hydrateRow(table, created), error: null };
      }

      if (action === "upsert" && payload) {
        const now = new Date().toISOString();
        const existingIdx =
          table === "document_shares"
            ? store.findIndex(
                (r) =>
                  r.document_id === payload?.document_id &&
                  r.shared_with_email === payload?.shared_with_email
              )
            : -1;

        if (existingIdx >= 0) {
          store[existingIdx] = {
            ...store[existingIdx],
            ...payload,
            updated_at: now,
          };
          return { data: hydrateRow(table, store[existingIdx]), error: null };
        }

        const created: Record<string, unknown> = {
          id: crypto.randomUUID(),
          created_at: now,
          updated_at: now,
          ...payload,
        };
        store.push(created);
        return { data: hydrateRow(table, created), error: null };
      }

      if (action === "update" && payload) {
        const matched = matches();
        const now = new Date().toISOString();
        for (const row of matched) {
          Object.assign(row, payload, { updated_at: now });
        }
        return {
          data: matched.map((r) => hydrateRow(table, r)),
          error: null,
        };
      }

      if (action === "delete") {
        const matched = matches();
        for (const target of matched) {
          const idx = store.indexOf(target);
          if (idx >= 0) store.splice(idx, 1);
        }
        return { data: matched, error: null };
      }

      let rows = matches().map((r) => hydrateRow(table, r));
      if (orderCol) {
        const col = orderCol;
        rows = rows.sort((a, b) => {
          const av = String(a[col] ?? "");
          const bv = String(b[col] ?? "");
          return orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
      return { data: rows, error: null };
    };

    const builder = {
      select() {
        return builder;
      },
      insert(data: Record<string, unknown>) {
        action = "insert";
        payload = data;
        return builder;
      },
      upsert(data: Record<string, unknown>) {
        action = "upsert";
        payload = data;
        return builder;
      },
      update(data: Record<string, unknown>) {
        action = "update";
        payload = data;
        return builder;
      },
      delete() {
        action = "delete";
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push((row) => row[col] === val);
        return builder;
      },
      neq(col: string, val: unknown) {
        filters.push((row) => row[col] !== val);
        return builder;
      },
      ilike(col: string, val: string) {
        filters.push(
          (row) => String(row[col] ?? "").toLowerCase() === val.toLowerCase()
        );
        return builder;
      },
      in(col: string, vals: unknown[]) {
        filters.push((row) => vals.includes(row[col]));
        return builder;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        orderCol = col;
        orderAsc = opts?.ascending ?? true;
        return builder;
      },
      async maybeSingle() {
        const res = await execute();
        const first = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
        return { data: first, error: res.error };
      },
      async single() {
        const res = await execute();
        const first = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
        return { data: first, error: res.error };
      },
      then<TResult1 = Awaited<ReturnType<typeof execute>>>(
        onfulfilled?:
          | ((
              value: Awaited<ReturnType<typeof execute>>
            ) => TResult1 | PromiseLike<TResult1>)
          | null
      ) {
        return execute().then(onfulfilled);
      },
    };

    return builder;
  }

  return {
    auth: {
      async getUser() {
        return { data: { user: getAuthUser ? getAuthUser() : null } };
      },
    },
    from(table: "users" | "documents" | "document_shares") {
      return makeBuilder(table);
    },
  } as unknown as SupabaseClient;
}

