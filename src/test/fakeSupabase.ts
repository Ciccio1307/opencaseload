/**
 * Minimal in-memory stand-in for the Supabase client, covering only the query
 * shapes this app uses. Tables are arrays of rows; every query is recorded so
 * tests can assert what was sent.
 */
type Row = Record<string, unknown>;
type Filter = { column: string; values: unknown[] };

export type RecordedQuery = {
  table: string;
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  payload?: unknown;
  filters: Filter[];
};

type RpcHandler = (args: Record<string, unknown>, tables: Record<string, Row[]>) => unknown;

/**
 * `rpc` maps function names to handlers; calling any other function fails
 * like PostgREST does for a missing function (PGRST202).
 */
export function createFakeSupabase(
  initial: Record<string, Row[]> = {},
  { rpc: handlers = {} }: { rpc?: Record<string, RpcHandler> } = {}
) {
  const tables: Record<string, Row[]> = structuredClone(initial);
  const queries: RecordedQuery[] = [];
  let nextId = 1;

  function from(table: string) {
    tables[table] ??= [];
    const q: RecordedQuery = { table, op: 'select', filters: [] };
    queries.push(q);

    const matches = (row: Row) => q.filters.every(f => f.values.includes(row[f.column]));

    function run(): { data: unknown; error: null } {
      const rows = tables[table];
      switch (q.op) {
        case 'select':
          return { data: rows.filter(matches).map(r => ({ ...r })), error: null };
        case 'insert': {
          const created = (q.payload as Row[]).map(r => ({ id: `id-${nextId++}`, ...r }));
          rows.push(...created);
          return { data: created, error: null };
        }
        case 'upsert': {
          const row = q.payload as Row;
          const existing = rows.find(r => r.key === row.key);
          if (existing) Object.assign(existing, row);
          else rows.push({ ...row });
          return { data: null, error: null };
        }
        case 'update': {
          const hit = rows.filter(matches);
          hit.forEach(r => Object.assign(r, q.payload));
          return { data: hit.map(r => ({ ...r })), error: null };
        }
        case 'delete':
          tables[table] = rows.filter(r => !matches(r));
          return { data: null, error: null };
      }
    }

    const builder = {
      select: () => builder,
      order: () => builder,
      insert: (payload: Row[]) => ((q.op = 'insert'), (q.payload = payload), builder),
      update: (payload: Row) => ((q.op = 'update'), (q.payload = payload), builder),
      upsert: (payload: Row) => ((q.op = 'upsert'), (q.payload = payload), builder),
      delete: () => ((q.op = 'delete'), builder),
      eq: (column: string, value: unknown) => (q.filters.push({ column, values: [value] }), builder),
      in: (column: string, values: unknown[]) => (q.filters.push({ column, values }), builder),
      maybeSingle: async () => {
        const { data } = run();
        return { data: (data as Row[])[0] ?? null, error: null };
      },
      single: async () => {
        const { data } = run();
        const row = (data as Row[])[0];
        return row
          ? { data: row, error: null }
          : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } };
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve().then(run).then(resolve, reject),
    };
    return builder;
  }

  async function rpc(name: string, args: Record<string, unknown> = {}) {
    const handler = handlers[name];
    if (!handler) {
      return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name}` } };
    }
    try {
      return { data: handler(args, tables), error: null };
    } catch (e) {
      return { data: null, error: { code: 'P0001', message: (e as Error).message } };
    }
  }

  return { client: { from, rpc }, tables, queries };
}
