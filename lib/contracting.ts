type ContractingSource = {
  key: string;
  tableId?: string;
  count: number;
  ok: boolean;
  error?: string;
};

async function fetchCount(baseId: string, tableId: string, token: string) {
  let offset: string | undefined;
  let count = 0;

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Airtable returned ${response.status}: ${detail}`);
    }

    const json = await response.json() as {
      records: Array<{ id: string }>;
      offset?: string;
    };

    count += json.records.length;
    offset = json.offset;
  } while (offset);

  return count;
}

export async function getContractingSources(): Promise<ContractingSource[]> {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID_CONTRACTING;

  const tables = [
    { key: "Table 1", tableId: process.env.AIRTABLE_TABLE_ID_CONTRACTING_1 },
    { key: "Table 2", tableId: process.env.AIRTABLE_TABLE_ID_CONTRACTING_2 },
    { key: "Table 3", tableId: process.env.AIRTABLE_TABLE_ID_CONTRACTING_3 },
  ];

  if (!token || !baseId) {
    return tables.map(t => ({
      ...t,
      count: 0,
      ok: false,
      error: !token ? "AIRTABLE_PAT missing" : "AIRTABLE_BASE_ID_CONTRACTING missing",
    }));
  }

  return Promise.all(
    tables.map(async t => {
      if (!t.tableId) {
        return { ...t, count: 0, ok: false, error: `${t.key} ID missing` };
      }

      try {
        const count = await fetchCount(baseId, t.tableId, token);
        return { ...t, count, ok: true };
      } catch (error) {
        return {
          ...t,
          count: 0,
          ok: false,
          error: error instanceof Error ? error.message : "Unknown Airtable error",
        };
      }
    }),
  );
}
