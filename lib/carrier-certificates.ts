import { getSupabaseAdmin } from "./supabase-admin";

type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

const CARRIER_CERT_BASE_ID = "app5eoO1QYp4UAoaU";
const CARRIER_CERT_TABLE_ID = "tblx66f77FNlyJ3m4";
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

export async function getCarrierCertificatesForAgent(
  agentRecordId: string,
): Promise<CarrierCertificate[]> {
  const supabase = getSupabaseAdmin();

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

  const statusResponse = await fetch(
    `https://api.airtable.com/v0/${CARRIER_CERT_BASE_ID}/${CARRIER_CERT_TABLE_ID}/${input.agentRecordId}`,
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
    await supabase.from("carrier_certificates").delete().eq("id", metadata.id);
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);

    throw new Error(
      `Certificate was not saved because Airtable status update failed (${statusResponse.status}): ${detail}`,
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
