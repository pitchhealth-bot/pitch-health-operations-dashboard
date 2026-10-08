type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

type AirtableFieldSchema = {
  id: string;
  name: string;
  type: string;
};

const CARRIER_CERT_BASE_ID = "app7KT6sXkBqdwoO9";
const CARRIER_CERT_TABLE_ID = "tbloBQNL30Y9SPYaV";

export const CARRIER_CERTIFICATE_CARRIERS = [
  "Aetna",
  "Humana",
  "Cigna",
  "UHC",
  "Zing",
  "Devoted",
  "UNL",
  "Wellcare",
  "Heartland",
] as const;

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  return "";
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

async function fetchSchema(token: string): Promise<AirtableFieldSchema[]> {
  const response = await fetch(
    `https://api.airtable.com/v0/meta/bases/${CARRIER_CERT_BASE_ID}/tables`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Could not read Airtable schema (${response.status}): ${detail}`);
  }

  const json = await response.json() as {
    tables?: Array<{ id: string; fields?: AirtableFieldSchema[] }>;
  };

  return json.tables?.find(table => table.id === CARRIER_CERT_TABLE_ID)?.fields || [];
}

async function fetchAllRecords(token: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${CARRIER_CERT_BASE_ID}/${CARRIER_CERT_TABLE_ID}`,
    );
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Could not read carrier tracker (${response.status}): ${detail}`);
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

function findMatchingRecord(
  records: AirtableRecord[],
  email: string,
  name: string,
) {
  const emailTarget = normalize(email);
  const nameTarget = normalize(name);

  const byEmail = records.find(record => {
    const candidates = [
      textValue(record.fields["PHS Email"]),
      textValue(record.fields["Work Email"]),
      textValue(record.fields["Email"]),
      textValue(record.fields["Personal Email"]),
      textValue(record.fields["Personal email"]),
    ].map(normalize).filter(Boolean);

    return candidates.includes(emailTarget);
  });

  if (byEmail) return byEmail;

  return records.find(record => {
    const candidates = [
      textValue(record.fields["Name"]),
      textValue(record.fields["Agent Name"]),
      textValue(record.fields["Agent"]),
      textValue(record.fields["Candidate"]),
      textValue(record.fields["Candidate Name"]),
    ].map(normalize).filter(Boolean);

    return candidates.includes(nameTarget);
  });
}

function findAttachmentField(schema: AirtableFieldSchema[]) {
  const attachments = schema.filter(field =>
    field.type === "multipleAttachments" || field.type === "multipleAttachment",
  );

  const preferred = attachments.find(field => {
    const key = field.name.toLowerCase();
    return key.includes("carrier") && (key.includes("cert") || key.includes("document"));
  });

  if (preferred) return preferred;

  const certificate = attachments.find(field =>
    /cert|certificate/i.test(field.name),
  );

  if (certificate) return certificate;

  if (attachments.length === 1) return attachments[0];

  throw new Error(
    "Could not identify the carrier certificate attachment field in Airtable. Please tell me the exact attachment field name.",
  );
}

export async function uploadCarrierCertificate(input: {
  email: string;
  name: string;
  carrier: string;
  file: File;
}) {
  const token = process.env.AIRTABLE_PAT;

  if (!token) {
    throw new Error("AIRTABLE_PAT is not configured.");
  }

  if (!CARRIER_CERTIFICATE_CARRIERS.includes(
    input.carrier as (typeof CARRIER_CERTIFICATE_CARRIERS)[number],
  )) {
    throw new Error("Unsupported carrier.");
  }

  if (!input.file.size) {
    throw new Error("The uploaded certificate is empty.");
  }

  if (input.file.size > 5 * 1024 * 1024) {
    throw new Error("Carrier certificate uploads must be 5 MB or smaller.");
  }

  const [schema, records] = await Promise.all([
    fetchSchema(token),
    fetchAllRecords(token),
  ]);

  const record = findMatchingRecord(records, input.email, input.name);

  if (!record) {
    throw new Error(
      `No Airtable carrier-tracker record matched ${input.name}. Checked email first, then name.`,
    );
  }

  const carrierField = schema.find(field => field.name === input.carrier);

  if (!carrierField) {
    throw new Error(
      `The Airtable field "${input.carrier}" was not found in the carrier tracker.`,
    );
  }

  const attachmentField = findAttachmentField(schema);
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const base64 = bytes.toString("base64");

  const uploadResponse = await fetch(
    `https://content.airtable.com/v0/${CARRIER_CERT_BASE_ID}/${record.id}/${attachmentField.id}/uploadAttachment`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contentType: input.file.type || "application/octet-stream",
        file: base64,
        filename: input.file.name,
      }),
      cache: "no-store",
    },
  );

  if (!uploadResponse.ok) {
    const detail = await uploadResponse.text();
    throw new Error(
      `Carrier certificate upload failed (${uploadResponse.status}): ${detail}`,
    );
  }

  const statusResponse = await fetch(
    `https://api.airtable.com/v0/${CARRIER_CERT_BASE_ID}/${CARRIER_CERT_TABLE_ID}/${record.id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          [input.carrier]: "Contract Submitted",
        },
      }),
      cache: "no-store",
    },
  );

  if (!statusResponse.ok) {
    const detail = await statusResponse.text();
    throw new Error(
      `Certificate uploaded, but the carrier status could not be updated (${statusResponse.status}): ${detail}`,
    );
  }

  return {
    recordId: record.id,
    attachmentField: attachmentField.name,
    carrier: input.carrier,
    status: "Contract Submitted",
  };
}
