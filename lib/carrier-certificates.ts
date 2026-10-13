import { getSupabaseAdmin } from "./supabase-admin";

type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

const CARRIER_STATUS_BASE_ID = "app5eoO1QYp4UAoaU";
const CARRIER_STATUS_TABLE_ID = "tblx66f77FNlyJ3m4";

const CONTRACTING_CERT_BASE_ID =
  process.env.AIRTABLE_BASE_ID_CONTRACTING || "app7KT6sXkBqdwoO9";
const CONTRACTING_CERT_TABLE_ID =
  process.env.AIRTABLE_TABLE_ID_CONTRACTING_3 || "tbloBQNL30Y9SPYaV";
const STORAGE_BUCKET = "carrier-certificates";

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

const AIRTABLE_CERTIFICATE_FIELDS: Record<string, string> = {
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

export type CarrierCertificate = {
  id: string;
  carrier: string;
  fileName: string;
  contentType?: string;
  sizeBytes?: number;
  createdAt: string;
  uploadedByEmail: string;
  url: string;
};

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

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

type AirtableAttachment = {
  id?: string;
  url: string;
  filename: string;
  size?: number;
  type?: string;
};

function airtableAttachments(value: unknown): AirtableAttachment[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const attachment = item as Record<string, unknown>;
    if (typeof attachment.url !== "string") return [];

    return [{
      id: typeof attachment.id === "string" ? attachment.id : undefined,
      url: attachment.url,
      filename:
        typeof attachment.filename === "string"
          ? attachment.filename
          : "Carrier Certificate",
      size: typeof attachment.size === "number" ? attachment.size : undefined,
      type: typeof attachment.type === "string" ? attachment.type : undefined,
    }];
  });
}

async function syncAirtableCertificatesForAgent(input: {
  agentRecordId: string;
  email?: string;
  name?: string;
}) {
  const token = process.env.AIRTABLE_PAT;
  if (!token) return;

  const email = input.email?.trim() || "";
  const name = input.name?.trim() || "";
  if (!email && !name) return;

  let record: AirtableRecord | null = null;

  if (email) {
    record = await findContractingRecordByEmail(token, email);
  }

  if (!record && name) {
    const url = new URL(
      `https://api.airtable.com/v0/${CONTRACTING_CERT_BASE_ID}/${CONTRACTING_CERT_TABLE_ID}`,
    );
    url.searchParams.set("pageSize", "100");
    url.searchParams.set(
      "filterByFormula",
      `LOWER({Name})='${name.toLowerCase().replace(/'/g, "\\'")}'`,
    );

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (response.ok) {
      const json = await response.json() as { records?: AirtableRecord[] };
      record = json.records?.[0] || null;
    }
  }

  if (!record) return;

  const supabase = getSupabaseAdmin();

  const { data: existingRows, error: existingError } = await supabase
    .from("carrier_certificates")
    .select("source_airtable_attachment_id")
    .eq("agent_record_id", input.agentRecordId)
    .not("source_airtable_attachment_id", "is", null);

  if (existingError) throw new Error(existingError.message);

  const existingIds = new Set(
    (existingRows || [])
      .map(row => row.source_airtable_attachment_id)
      .filter(Boolean),
  );

  for (const carrier of CARRIER_CERTIFICATE_CARRIERS) {
    const fieldName = AIRTABLE_CERTIFICATE_FIELDS[carrier];
    const attachments = airtableAttachments(record.fields[fieldName]);

    for (const attachment of attachments) {
      const sourceId =
        attachment.id ||
        [record.id, carrier, attachment.filename, attachment.size || ""].join(":");

      if (existingIds.has(sourceId)) continue;

      const response = await fetch(attachment.url, { cache: "no-store" });
      if (!response.ok) continue;

      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length) continue;

      const contentType =
        attachment.type ||
        response.headers.get("content-type") ||
        "application/octet-stream";

      const storagePath = [
        input.agentRecordId,
        carrier.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        `airtable-${safeFileName(sourceId)}-${safeFileName(attachment.filename)}`,
      ].join("/");

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, buffer, {
          contentType,
          upsert: false,
        });

      if (uploadError && !/already exists/i.test(uploadError.message)) {
        continue;
      }

      const { error: insertError } = await supabase
        .from("carrier_certificates")
        .insert({
          agent_record_id: input.agentRecordId,
          agent_name: name,
          agent_email: email,
          carrier,
          storage_path: storagePath,
          file_name: attachment.filename,
          content_type: contentType,
          size_bytes: attachment.size || buffer.length,
          uploaded_by_email: "Imported from Airtable",
          source: "airtable",
          source_airtable_attachment_id: sourceId,
          source_airtable_record_id: record.id,
        });

      if (!insertError) {
        existingIds.add(sourceId);
      } else if (!/duplicate/i.test(insertError.message)) {
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      }
    }
  }
}

export async function getCarrierCertificatesForAgent(
  agentRecordId: string,
  email?: string,
  name?: string,
): Promise<CarrierCertificate[]> {
  const supabase = getSupabaseAdmin();

  try {
    await syncAirtableCertificatesForAgent({
      agentRecordId,
      email,
      name,
    });
  } catch (error) {
    console.error("Carrier certificate Airtable sync failed", error);
  }

  const { data, error } = await supabase
    .from("carrier_certificates")
    .select("*")
    .eq("agent_record_id", agentRecordId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = data || [];

  return Promise.all(rows.map(async row => {
    const { data: signed, error: signedError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(row.storage_path, 60 * 60);

    if (signedError) throw new Error(signedError.message);

    return {
      id: row.id,
      carrier: row.carrier,
      fileName: row.file_name,
      contentType: row.content_type || undefined,
      sizeBytes: row.size_bytes || undefined,
      createdAt: row.created_at,
      uploadedByEmail: row.uploaded_by_email,
      url: signed.signedUrl,
    };
  }));
}

async function findContractingRecordByEmail(token: string, email: string) {
  const url = new URL(
    `https://api.airtable.com/v0/${CONTRACTING_CERT_BASE_ID}/${CONTRACTING_CERT_TABLE_ID}`,
  );
  url.searchParams.set("pageSize", "100");
  url.searchParams.set(
    "filterByFormula",
    `LOWER({PHS Email})='${email.trim().toLowerCase().replace(/'/g, "\\'")}'`,
  );

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Could not find the Contracting and RTS Tracker record (${response.status}): ${detail}`,
    );
  }

  const json = await response.json() as { records?: AirtableRecord[] };
  return json.records?.[0] || null;
}

async function attachCertificateToContractingTracker(input: {
  token: string;
  email: string;
  carrier: string;
  fileName: string;
  fileUrl: string;
}) {
  const fieldName = AIRTABLE_CERTIFICATE_FIELDS[input.carrier];

  if (!fieldName) {
    throw new Error(`No Airtable certificate field is configured for ${input.carrier}.`);
  }

  const record = await findContractingRecordByEmail(input.token, input.email);

  if (!record) {
    throw new Error("No Contracting and RTS Tracker record matched this agent.");
  }

  const existing = Array.isArray(record.fields[fieldName])
    ? record.fields[fieldName] as Array<Record<string, unknown>>
    : [];

  const attachments = [
    ...existing.flatMap(item => {
      if (!item || typeof item !== "object" || typeof item.url !== "string") return [];
      return [{
        url: item.url,
        ...(typeof item.filename === "string" ? { filename: item.filename } : {}),
      }];
    }),
    {
      url: input.fileUrl,
      filename: input.fileName,
    },
  ];

  const response = await fetch(
    `https://api.airtable.com/v0/${CONTRACTING_CERT_BASE_ID}/${CONTRACTING_CERT_TABLE_ID}/${record.id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          [fieldName]: attachments,
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Airtable certificate attachment failed (${response.status}): ${detail}`,
    );
  }

  return { recordId: record.id, fieldName };
}

export async function uploadCarrierCertificate(input: {
  agentRecordId: string;
  email: string;
  name: string;
  carrier: string;
  file: File;
  uploadedByEmail: string;
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

  const allowedTypes = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
  ]);

  if (input.file.type && !allowedTypes.has(input.file.type)) {
    throw new Error("Only PDF, PNG, JPG, and JPEG files are supported.");
  }

  const supabase = getSupabaseAdmin();
  const storagePath = [
    input.agentRecordId,
    input.carrier.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    `${Date.now()}-${safeFileName(input.file.name)}`,
  ].join("/");

  const fileBuffer = Buffer.from(await input.file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: input.file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Dashboard file storage failed: ${uploadError.message}`);
  }

  const { data: metadata, error: metadataError } = await supabase
    .from("carrier_certificates")
    .insert({
      agent_record_id: input.agentRecordId,
      agent_name: input.name,
      agent_email: input.email,
      carrier: input.carrier,
      storage_path: storagePath,
      file_name: input.file.name,
      content_type: input.file.type || null,
      size_bytes: input.file.size,
      uploaded_by_email: input.uploadedByEmail,
    })
    .select("*")
    .single();

  if (metadataError) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw new Error(`Dashboard certificate record failed: ${metadataError.message}`);
  }

  const { data: airtableSigned, error: airtableSignedError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (airtableSignedError) {
    await supabase.from("carrier_certificates").delete().eq("id", metadata.id);
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw new Error(`Could not create certificate URL: ${airtableSignedError.message}`);
  }

  try {
    await attachCertificateToContractingTracker({
      token,
      email: input.email,
      carrier: input.carrier,
      fileName: input.file.name,
      fileUrl: airtableSigned.signedUrl,
    });
  } catch (error) {
    await supabase.from("carrier_certificates").delete().eq("id", metadata.id);
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw error;
  }

  const statusResponse = await fetch(
    `https://api.airtable.com/v0/${CARRIER_STATUS_BASE_ID}/${CARRIER_STATUS_TABLE_ID}/${input.agentRecordId}`,
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
      `Certificate was attached in Airtable, but the carrier status update failed (${statusResponse.status}): ${detail}`,
    );
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (signedError) throw new Error(signedError.message);

  return {
    recordId: input.agentRecordId,
    carrier: input.carrier,
    status: "Contract Submitted",
    certificate: {
      id: metadata.id,
      carrier: metadata.carrier,
      fileName: metadata.file_name,
      contentType: metadata.content_type || undefined,
      sizeBytes: metadata.size_bytes || undefined,
      createdAt: metadata.created_at,
      uploadedByEmail: metadata.uploaded_by_email,
      url: signed.signedUrl,
    } satisfies CarrierCertificate,
  };
}
