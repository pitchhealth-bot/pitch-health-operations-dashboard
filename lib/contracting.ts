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
  { revalidate: 300, tags: ["contracting-data", "contracting-table-1"] },
);

const getTable2Records = unstable_cache(
  async () => fetchAllRecords(
    process.env.AIRTABLE_TABLE_ID_CONTRACTING_2 || "tblAi2SDsNAqmvJuH",
  ),
  ["pitch-contracting-table-2-v3"],
  { revalidate: 300, tags: ["contracting-data", "contracting-table-2"] },
);

const getTable3Records = unstable_cache(
  async () => fetchAllRecords(process.env.AIRTABLE_TABLE_ID_CONTRACTING_3),
  ["pitch-contracting-table-3-v2"],
  { revalidate: 300, tags: ["contracting-data", "contracting-table-3"] },
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

export type CarrierCertificateAttachment = {
  carrier: string;
  airtableRecordId: string;
  attachmentId?: string;
  url: string;
  filename: string;
  size?: number;
  type?: string;
};

function nameMatches(record: AirtableRecord, name: string) {
  const target = name.trim().toLowerCase();
  if (!target) return false;

  const candidates = [
    textValue(record.fields["Name"]),
    textValue(record.fields["Agent Name"]),
    textValue(record.fields["Full Name"]),
  ]
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);

  return candidates.includes(target);
}

export async function getCarrierCertificateAttachmentsForAgent(
  email?: string,
  name?: string,
): Promise<CarrierCertificateAttachment[]> {
  const certificateFields: Record<string, string> = {
    Aetna: "Aetna Certificate",
    Humana: "Humana Certificate",
    Cigna: "Cigna Certificate",
    UHC: "UHC Certificate",
    Zing: "Zing Certificate",
    Devoted: "Devoted Certificate",
    UNL: "UNL Certificate",
    Wellcare: "Wellcare Certificate",
    Heartland: "Heartland Certificate",
  };

  try {
    const records = await getTable3Records();

    const match =
      (email ? records.find(record => emailMatches(record, email)) : undefined) ||
      (name ? records.find(record => nameMatches(record, name)) : undefined);

    if (!match) return [];

    return Object.entries(certificateFields).flatMap(([carrier, fieldName]) =>
      attachmentList(match.fields[fieldName], `${carrier} Certificate`).map(file => ({
        carrier,
        airtableRecordId: match.id,
        attachmentId: file.id,
        url: file.url,
        filename: file.filename,
        size: file.size,
        type: file.type,
      })),
    );
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
  options?: {
    choices?: Array<{
      id?: string;
      name: string;
      color?: string;
    }>;
  };
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
  const allowedStatuses = new Set([
    "None",
    "RTS",
    "Requested",
    "Contract Submitted",
    "Certifications complete",
    "Completed",
    "N/A",
    "Rejected",
    "Release Needed",
    "Requested Release from PHS",
    "Released from PHS",
  ]);

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


export type CertificationDocumentKind = "ahip2027" | "sunfire";

type TableSchema = {
  id: string;
  name: string;
  fields?: AirtableFieldSchema[];
};

async function getContractingDocumentsSchema(): Promise<AirtableFieldSchema[]> {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID_CONTRACTING || "app7KT6sXkBqdwoO9";
  const tableId = process.env.AIRTABLE_TABLE_ID_CONTRACTING_1 || "tblJPbR1iOlU9kFE7";

  if (!token || !baseId || !tableId) return [];

  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) return [];

  const json = await response.json() as { tables?: TableSchema[] };
  return json.tables?.find(table => table.id === tableId)?.fields || [];
}

function certificationFieldName(
  kind: CertificationDocumentKind,
  schema: AirtableFieldSchema[],
  _recordFields?: Record<string, unknown>,
) {
  const expectedName =
    kind === "ahip2027"
      ? "2027 AHIP Document"
      : "SunFire Reports";

  const field = schema.find(
    item => item.name === expectedName && item.type === "multipleAttachments",
  );

  return field?.name || "";
}

function findAgentRecord(
  records: AirtableRecord[],
  email?: string,
  name?: string,
) {
  return (
    (email ? records.find(record => emailMatches(record, email)) : undefined) ||
    (name ? records.find(record => nameMatches(record, name)) : undefined)
  );
}

export async function getCertificationDocumentsForAgent(
  email?: string,
  name?: string,
) {
  try {
    const [records, schema] = await Promise.all([
      getTable1Records(),
      getContractingDocumentsSchema(),
    ]);

    const match = findAgentRecord(records, email, name);
    if (!match) return { ahip: [], sunfire: [] };

    const ahipField = certificationFieldName("ahip2027", schema, match.fields);
    const sunfireField = certificationFieldName("sunfire", schema, match.fields);

    return {
      ahip: attachmentList(match.fields[ahipField], "AHIP 2027"),
      sunfire: sunfireField
        ? attachmentList(match.fields[sunfireField], "SunFire Report")
        : [],
    };
  } catch {
    return { ahip: [], sunfire: [] };
  }
}

export async function updateCertificationDocumentForAgent(input: {
  email?: string;
  name?: string;
  kind: CertificationDocumentKind;
  fileUrl?: string;
  fileName?: string;
  removeAttachmentIds?: string[];
}) {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID_CONTRACTING || "app7KT6sXkBqdwoO9";
  const tableId = process.env.AIRTABLE_TABLE_ID_CONTRACTING_1 || "tblJPbR1iOlU9kFE7";

  if (!token) throw new Error("AIRTABLE_PAT is not configured.");

  const [records, schema] = await Promise.all([
    getTable1Records(),
    getContractingDocumentsSchema(),
  ]);

  const match = findAgentRecord(records, input.email, input.name);
  if (!match) {
    throw new Error("No Contracting Documents & Information record matched this agent.");
  }

  const fieldName = certificationFieldName(input.kind, schema, match.fields);
  if (!fieldName) {
    throw new Error(
      input.kind === "sunfire"
        ? "Could not find the SunFire Reports attachment field in Contracting Documents & Information."
        : "Could not find the 2027 AHIP Document field in Contracting Documents & Information.",
    );
  }

  const removeIds = new Set(input.removeAttachmentIds || []);
  const currentAttachments = attachmentList(match.fields[fieldName], fieldName);

  const nextAttachments: Array<{ id?: string; url?: string; filename?: string }> =
    currentAttachments
      .filter(file => !file.id || !removeIds.has(file.id))
      .map(file => file.id ? { id: file.id } : { url: file.url, filename: file.filename });

  if (input.fileUrl && input.fileName) {
    nextAttachments.push({
      url: input.fileUrl,
      filename: input.fileName,
    });
  }

  const response = await fetch(
    `https://api.airtable.com/v0/${baseId}/${tableId}/${match.id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          [fieldName]: nextAttachments,
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Airtable certification update failed (${response.status}): ${detail}`);
  }

  const updated = await response.json() as AirtableRecord;
  return {
    recordId: match.id,
    fieldName,
    attachments: attachmentList(updated.fields[fieldName], fieldName),
  };
}


export type LicensingStageMilestone = {
  recordId: string;
  name: string;
  email: string;
  npn: string;
  purchasedLicensingCourse: string;
  purchasedLicensingExam: string;
  purchasedResidentStates: string;
  purchasedNonResidentStates: string;
};

export async function getLicensingStageMilestones(): Promise<LicensingStageMilestone[]> {
  try {
    const records = await getTable2Records();

    return records.map(record => {
      const fields = record.fields;
      return {
        recordId: record.id,
        name: textValue(
          fields["Name"] ||
          fields["Agent Name"] ||
          fields["Full Name"],
        ),
        email: textValue(
          fields["PHS Email"] ||
          fields["Work Email"] ||
          fields["Email"],
        ),
        npn: textValue(
          fields["NPN"] ||
          fields["National Producer Number"],
        ),
        purchasedLicensingCourse: textValue(
          fields["Purchased Licensing Course?"] ??
          fields["Purchased Licensing Course"],
        ),
        purchasedLicensingExam: textValue(
          fields["Purchased Licensing Exam?"] ??
          fields["Purchased Licensing Exam"],
        ),
        purchasedResidentStates: textValue(
          fields["Purchased Resident States?"] ??
          fields["Purchased Resident States"],
        ),
        purchasedNonResidentStates: textValue(
          fields["Purchased Non-resident States?"] ??
          fields["Purchased Non-Resident States?"] ??
          fields["Purchased Nonresident States?"] ??
          fields["Purchased Non-resident States"] ??
          fields["Purchased Non-Resident States"],
        ),
      };
    });
  } catch (error) {
    console.error("Licensing Stages (Tracker) milestone load failed", error);
    return [];
  }
}


export type LicensingStageTrackerRecord = {
  recordId: string;
  name: string;
  email: string;
  npn: string;
  fields: Record<string, string>;
};

function displayTrackerValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
          return String(item);
        }
        if (item && typeof item === "object" && "name" in item) {
          return String((item as { name?: unknown }).name || "");
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") {
    if ("name" in value) return String((value as { name?: unknown }).name || "");
    return "";
  }
  return "";
}

export async function getLicensingStageTrackerRecords(): Promise<LicensingStageTrackerRecord[]> {
  try {
    const records = await getTable2Records();

    return records.map(record => {
      const fields = record.fields;
      const displayFields: Record<string, string> = {};

      for (const [key, value] of Object.entries(fields)) {
        displayFields[key] = displayTrackerValue(value);
      }

      return {
        recordId: record.id,
        name: textValue(
          fields["Name"] ||
          fields["Agent Name"] ||
          fields["Full Name"],
        ),
        email: textValue(
          fields["PHS Email"] ||
          fields["Work Email"] ||
          fields["Email"],
        ),
        npn: textValue(
          fields["NPN"] ||
          fields["National Producer Number"],
        ),
        fields: displayFields,
      };
    });
  } catch (error) {
    console.error("Licensing Stages (Tracker) record load failed", error);
    return [];
  }
}


export type LicensingJourneyFieldConfig = {
  name: string;
  actualName: string;
  type: string;
  options: Array<{ name: string; color?: string }>;
};

const JOURNEY_TRACKER_FIELDS = [
  "Purchased Licensing Course?",
  "Purchased Licensing Exam?",
  "Exam Date",
  "Passed Licensing exam?",
  "2nd Exam Date",
  "Completed FingerPrints?",
  "Purchased Resident States?",
  "Purchased Non-Resident States?",
  "Unresponsive??",
] as const;

const JOURNEY_TRACKER_FIELD_ALIASES: Record<string, string[]> = {
  "Purchased Licensing Course?": ["Purchased Licensing Course"],
  "Purchased Licensing Exam?": ["Purchased Licensing Exam"],
  "Exam Date": ["Licensing Exam Date"],
  "Passed Licensing exam?": ["Passed Licensing Exam?", "Passed Licensing exam"],
  "2nd Exam Date": ["Second Exam Date", "2nd Licensing Exam Date"],
  "Completed FingerPrints?": ["Completed Fingerprints?", "Completed Finger Prints?"],
  "Purchased Resident States?": ["Purchased Resident States"],
  "Purchased Non-Resident States?": [
    "Purchased Non-resident States?",
    "Purchased Nonresident States?",
    "Purchased Non-Resident States",
    "Purchased Non-resident States",
  ],
  "Unresponsive??": ["Unresponsive?", "Unresponsive"],
};

function findJourneyField(
  schema: AirtableFieldSchema[],
  canonicalName: string,
) {
  const names = [canonicalName, ...(JOURNEY_TRACKER_FIELD_ALIASES[canonicalName] || [])];
  return schema.find(field => names.includes(field.name));
}

async function getLicensingStagesSchema(): Promise<AirtableFieldSchema[]> {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID_CONTRACTING || "app7KT6sXkBqdwoO9";
  const tableId = process.env.AIRTABLE_TABLE_ID_CONTRACTING_2 || "tblAi2SDsNAqmvJuH";

  if (!token || !baseId || !tableId) return [];

  const response = await fetch(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!response.ok) return [];

  const json = await response.json() as {
    tables?: Array<{
      id: string;
      fields?: AirtableFieldSchema[];
    }>;
  };

  return json.tables?.find(table => table.id === tableId)?.fields || [];
}

export async function getLicensingJourneyFieldConfig(): Promise<LicensingJourneyFieldConfig[]> {
  const schema = await getLicensingStagesSchema();

  const fallbackOptions: Record<string, Array<{ name: string }>> = {
    "Purchased Licensing Course?": [{ name: "Yes" }, { name: "No" }],
    "Purchased Licensing Exam?": [{ name: "Yes" }, { name: "No" }],
    "Passed Licensing exam?": [{ name: "Yes" }, { name: "No" }],
    "Completed FingerPrints?": [
      { name: "Completed" },
      { name: "Didn't Schedule yet" },
      { name: "Pending Appointment Date" },
      { name: "Not Applicable" },
    ],
    "Purchased Resident States?": [
      { name: "Completed" },
    ],
    "Purchased Non-Resident States?": [
      { name: "Completed" },
    ],
    "Unresponsive??": [
      { name: "Unresponsive-Mel" },
      { name: "Unresponsive-Jos" },
      { name: "Spoke with Agent" },
      { name: "LVM" },
    ],
  };

  return JOURNEY_TRACKER_FIELDS.map(name => {
    const field = findJourneyField(schema, name);

    return {
      name,
      actualName: field?.name || name,
      type: field?.type || (name.toLowerCase().includes("date") ? "date" : "singleSelect"),
      options: field?.options?.choices?.map(choice => ({
        name: choice.name,
        color: choice.color,
      })) || fallbackOptions[name] || [],
    };
  });
}

export async function updateLicensingStageTrackerRecord(
  recordId: string,
  updates: Record<string, string | null>,
) {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID_CONTRACTING;
  const tableId = process.env.AIRTABLE_TABLE_ID_CONTRACTING_2;

  if (!token || !baseId || !tableId) {
    throw new Error("Licensing Stages Airtable configuration is incomplete.");
  }

  const allowed = new Set<string>(JOURNEY_TRACKER_FIELDS);
  const schema = await getLicensingStagesSchema();
  const fields: Record<string, string | null> = {};

  for (const [field, value] of Object.entries(updates)) {
    if (!allowed.has(field)) continue;
    const actualField = findJourneyField(schema, field)?.name || field;
    fields[actualField] = value && value.trim() ? value.trim() : null;
  }

  if (!Object.keys(fields).length) {
    throw new Error("No supported Licensing Stages fields were supplied.");
  }

  const response = await fetch(
    `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`,
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
    throw new Error(`Airtable Licensing Stages update failed (${response.status}): ${detail}`);
  }

  return await response.json() as AirtableRecord;
}
