import { unstable_cache } from "next/cache";

type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

type ContractingSource = {
  key: string;
  tableId?: string;
  count: number;
  ok: boolean;
  error?: string;
};

export type CarrierStatus = {
  carrier: string;
  status: string;
  writingNumber?: string;
};

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (Array.isArray(value)) return value.map(String).join(", ").trim();
  return "";
}

function normalizeFieldName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function fetchAllRecords(tableId?: string): Promise<AirtableRecord[]> {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID_CONTRACTING;

  if (!token || !baseId || !tableId) return [];

  const records: AirtableRecord[] = [];
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
      const detail = await response.text();
      throw new Error(`Airtable returned ${response.status}: ${detail}`);
    }

    const json = await response.json() as {
      records: AirtableRecord[];
      offset?: string;
    };

    records.push(...json.records);
    offset = json.offset;
  } while (offset);

  return records;
}

const getTable1Records = unstable_cache(
  async () => fetchAllRecords(process.env.AIRTABLE_TABLE_ID_CONTRACTING_1),
  ["pitch-contracting-table-1-v2"],
  { revalidate: 30, tags: ["contracting-data", "contracting-table-1"] },
);

const getTable2Records = unstable_cache(
  async () => fetchAllRecords(process.env.AIRTABLE_TABLE_ID_CONTRACTING_2),
  ["pitch-contracting-table-2-v2"],
  { revalidate: 30, tags: ["contracting-data", "contracting-table-2"] },
);

const getTable3Records = unstable_cache(
  async () => fetchAllRecords(process.env.AIRTABLE_TABLE_ID_CONTRACTING_3),
  ["pitch-contracting-table-3-v2"],
  { revalidate: 30, tags: ["contracting-data", "contracting-table-3"] },
);

export async function getContractingSources(): Promise<ContractingSource[]> {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID_CONTRACTING;

  const tables = [
    {
      key: "Contracting Documents & Information",
      tableId: process.env.AIRTABLE_TABLE_ID_CONTRACTING_1,
      loader: getTable1Records,
    },
    {
      key: "Licensing Stages (Tracker)",
      tableId: process.env.AIRTABLE_TABLE_ID_CONTRACTING_2,
      loader: getTable2Records,
    },
    {
      key: "Contracting and RTS Tracker",
      tableId: process.env.AIRTABLE_TABLE_ID_CONTRACTING_3,
      loader: getTable3Records,
    },
  ];

  if (!token || !baseId) {
    return tables.map(({ key, tableId }) => ({
      key,
      tableId,
      count: 0,
      ok: false,
      error: !token ? "AIRTABLE_PAT missing" : "AIRTABLE_BASE_ID_CONTRACTING missing",
    }));
  }

  return Promise.all(
    tables.map(async ({ key, tableId, loader }) => {
      if (!tableId) {
        return { key, tableId, count: 0, ok: false, error: `${key} ID missing` };
      }

      try {
        const records = await loader();
        return { key, tableId, count: records.length, ok: true };
      } catch (error) {
        return {
          key,
          tableId,
          count: 0,
          ok: false,
          error: error instanceof Error ? error.message : "Unknown Airtable error",
        };
      }
    }),
  );
}

function attachmentList(value: unknown, fallbackName: string) {
  if (!Array.isArray(value)) return [];

  return value.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const attachment = item as Record<string, unknown>;
    if (typeof attachment.url !== "string") return [];

    return [{
      id: typeof attachment.id === "string" ? attachment.id : undefined,
      url: attachment.url,
      filename: typeof attachment.filename === "string" ? attachment.filename : fallbackName,
      size: typeof attachment.size === "number" ? attachment.size : undefined,
      type: typeof attachment.type === "string" ? attachment.type : undefined,
    }];
  });
}

function emailMatches(record: AirtableRecord, email: string) {
  const target = email.trim().toLowerCase();
  const candidates = [
    textValue(record.fields["PHS Email"]),
    textValue(record.fields["Work Email"]),
    textValue(record.fields["Email"]),
  ].map(value => value.toLowerCase()).filter(Boolean);

  return candidates.includes(target);
}

export async function getAhip2027ForAgent(email?: string) {
  if (!email) return [];

  try {
    const records = await getTable1Records();
    const match = records.find(record => emailMatches(record, email));
    return attachmentList(match?.fields["2027 AHIP Document"], "AHIP 2027");
  } catch {
    return [];
  }
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
      const valueText = textValue(value);
      if (valueText) return valueText;
    }
  }

  return "";
}

export async function getCarrierStatusesForAgent(email?: string): Promise<CarrierStatus[]> {
  const carriers = ["Aetna","Humana","Cigna","UHC","Zing","Devoted","UNL","Wellcare","Heartland"];

  if (!email) {
    return carriers.map(carrier => ({ carrier, status: "None" }));
  }

  try {
    const records = await getTable3Records();
    const match = records.find(record => emailMatches(record, email));

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
  } catch {
    return carriers.map(carrier => ({ carrier, status: "None" }));
  }
}

export async function getSunFireReportForAgent(email?: string) {
  if (!email) return [];

  try {
    const records = await getTable3Records();
    const match = records.find(record => emailMatches(record, email));
    return attachmentList(match?.fields["SunFire Report copy"], "SunFire Report");
  } catch {
    return [];
  }
}


export type CarrierStatusUpdate = {
  carrier: string;
  status: string;
  writingNumber?: string;
};

type AirtableFieldSchema = {
  id: string;
  name: string;
  type: string;
};

async function getTable3Schema(): Promise<AirtableFieldSchema[]> {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID_CONTRACTING;
  const tableId = process.env.AIRTABLE_TABLE_ID_CONTRACTING_3;

  if (!token || !baseId || !tableId) return [];

  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) return [];

  const json = await response.json() as {
    tables?: Array<{
      id: string;
      fields?: AirtableFieldSchema[];
    }>;
  };

  return json.tables?.find(table => table.id === tableId)?.fields || [];
}

function findWritingFieldName(
  fields: Record<string, unknown>,
  schema: AirtableFieldSchema[],
  carrier: string,
) {
  const carrierKey = normalizeFieldName(carrier);
  const matches = (name: string) => {
    const normalized = normalizeFieldName(name);
    return normalized.includes(carrierKey) && normalized.includes("writing");
  };

  const schemaField = schema.find(field => matches(field.name));
  if (schemaField) return schemaField.name;

  return Object.keys(fields).find(matches) || "";
}

function airtableValueForField(
  fieldName: string,
  schema: AirtableFieldSchema[],
  value: string,
) {
  if (!value) return null;
  const field = schema.find(item => item.name === fieldName);

  if (field?.type === "number" || field?.type === "currency" || field?.type === "percent") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }

  return value;
}

export async function updateCarrierStatusesForAgent(
  email: string,
  updates: CarrierStatusUpdate[],
) {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID_CONTRACTING;
  const tableId = process.env.AIRTABLE_TABLE_ID_CONTRACTING_3;

  if (!token || !baseId || !tableId) {
    throw new Error("Contracting Airtable configuration is incomplete.");
  }

  const allowedCarriers = new Set([
    "Aetna","Humana","Cigna","UHC","Zing","Devoted","UNL","Wellcare","Heartland",
  ]);
  const allowedStatuses = new Set(["None","Requested","Completed","Ineligible","RTS"]);

  const records = await getTable3Records();
  const match = records.find(record => emailMatches(record, email));

  if (!match) {
    throw new Error("No Contracting and RTS Tracker record matched this agent.");
  }

  const schema = await getTable3Schema();
  const fields: Record<string, unknown> = {};

  for (const update of updates) {
    if (!allowedCarriers.has(update.carrier)) {
      throw new Error(`Unsupported carrier: ${update.carrier}`);
    }
    if (!allowedStatuses.has(update.status)) {
      throw new Error(`Unsupported carrier status: ${update.status}`);
    }

    fields[update.carrier] = update.status === "None" ? null : update.status;

    const writingField = findWritingFieldName(match.fields, schema, update.carrier);

    if (update.status === "RTS" && update.writingNumber?.trim()) {
      if (!writingField) {
        throw new Error(
          `Could not find the Airtable writing-number field for ${update.carrier}.`,
        );
      }
      fields[writingField] = airtableValueForField(
        writingField,
        schema,
        update.writingNumber.trim(),
      );
    } else if (writingField) {
      fields[writingField] = null;
    }
  }

  const response = await fetch(
    `https://api.airtable.com/v0/${baseId}/${tableId}/${match.id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Airtable update failed (${response.status}): ${detail}`);
  }

  return {
    recordId: match.id,
    previous: updates.map(update => ({
      carrier: update.carrier,
      status: textValue(match.fields[update.carrier]) || "None",
      writingNumber: findWritingNumber(match.fields, update.carrier) || "",
    })),
  };
}
