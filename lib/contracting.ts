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
    { key: "Contracting Documents & Information", tableId: process.env.AIRTABLE_TABLE_ID_CONTRACTING_1 },
    { key: "Licensing Stages (Tracker)", tableId: process.env.AIRTABLE_TABLE_ID_CONTRACTING_2 },
    { key: "Contracting and RTS Tracker", tableId: process.env.AIRTABLE_TABLE_ID_CONTRACTING_3 },
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


export async function getAhip2027ForAgent(email?: string) {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID_CONTRACTING;
  const tableId = process.env.AIRTABLE_TABLE_ID_CONTRACTING_1;

  if (!token || !baseId || !tableId || !email) return [];

  const records: Array<{ id: string; fields: Record<string, unknown> }> = [];
  let offset: string | undefined;

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) return [];

    const json = await response.json() as {
      records: Array<{ id: string; fields: Record<string, unknown> }>;
      offset?: string;
    };

    records.push(...json.records);
    offset = json.offset;
  } while (offset);

  const target = email.trim().toLowerCase();
  const match = records.find(record => {
    const value = record.fields["PHS Email"];
    return typeof value === "string" && value.trim().toLowerCase() === target;
  });

  const value = match?.fields["2027 AHIP Document"];
  if (!Array.isArray(value)) return [];

  return value.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const a = item as Record<string, unknown>;
    if (typeof a.url !== "string") return [];
    return [{
      id: typeof a.id === "string" ? a.id : undefined,
      url: a.url,
      filename: typeof a.filename === "string" ? a.filename : "AHIP 2027",
      size: typeof a.size === "number" ? a.size : undefined,
      type: typeof a.type === "string" ? a.type : undefined,
    }];
  });
}


export type CarrierStatus = {
  carrier: string;
  status: string;
  writingNumber?: string;
};

function normalizeFieldName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (Array.isArray(value)) return value.map(String).join(", ").trim();
  return "";
}

function findWritingNumber(fields: Record<string, unknown>, carrier: string) {
  const carrierKey = normalizeFieldName(carrier);

  for (const [key, value] of Object.entries(fields)) {
    const normalized = normalizeFieldName(key);
    const looksLikeWritingNumber =
      normalized.includes(carrierKey) &&
      (
        normalized.includes("writingnumber") ||
        normalized.includes("writingno") ||
        normalized.includes("writingnum") ||
        normalized.includes("writing")
      );

    if (looksLikeWritingNumber) {
      const text = textValue(value);
      if (text) return text;
    }
  }

  return "";
}

export async function getCarrierStatusesForAgent(email?: string): Promise<CarrierStatus[]> {
  const carriers = ["Aetna","Humana","Cigna","UHC","Zing","Devoted","UNL","Wellcare","Heartland"];

  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID_CONTRACTING;
  const tableId = process.env.AIRTABLE_TABLE_ID_CONTRACTING_3;

  if (!token || !baseId || !tableId || !email) {
    return carriers.map(carrier => ({ carrier, status: "None" }));
  }

  const records: Array<{ id: string; fields: Record<string, unknown> }> = [];
  let offset: string | undefined;

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      return carriers.map(carrier => ({ carrier, status: "None" }));
    }

    const json = await response.json() as {
      records: Array<{ id: string; fields: Record<string, unknown> }>;
      offset?: string;
    };

    records.push(...json.records);
    offset = json.offset;
  } while (offset);

  const target = email.trim().toLowerCase();
  const match = records.find(record => {
    const candidates = [
      textValue(record.fields["PHS Email"]),
      textValue(record.fields["Work Email"]),
      textValue(record.fields["Email"]),
    ].map(v => v.toLowerCase()).filter(Boolean);

    return candidates.includes(target);
  });

  if (!match) {
    return carriers.map(carrier => ({ carrier, status: "None" }));
  }

  return carriers.map(carrier => {
    const status = textValue(match.fields[carrier]) || "None";
    const writingNumber = /^rts$/i.test(status)
      ? findWritingNumber(match.fields, carrier)
      : "";

    return {
      carrier,
      status,
      writingNumber: writingNumber || undefined,
    };
  });
}
