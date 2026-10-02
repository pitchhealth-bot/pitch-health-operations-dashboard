import type { Agent, DashboardData, PipelineStage } from "./types";
import { sampleAgents } from "./mock-data";

const allowedStages: PipelineStage[] = ["Pre-Licensing","Exam","Pre-Contracting","Contracting","RTS"];

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(String).join(", ");
  return "";
}


function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findFieldValue(fields: Record<string, unknown>, aliases: string[]): unknown {
  const normalizedAliases = aliases.map(normalizeKey);
  for (const [key, value] of Object.entries(fields)) {
    const nk = normalizeKey(key);
    if (normalizedAliases.includes(nk)) return value;
  }
  return undefined;
}

function findLicensingStatus(fields: Record<string, unknown>): string {
  const direct = findFieldValue(fields, [
    "Licensing",
    "Licensing Status",
    "License Status",
    "Licensed / Non-licensed",
    "Licensed/Non-licensed",
    "License Type",
  ]);
  const directText = asText(direct).trim();
  if (directText) return directText;

  for (const [key, value] of Object.entries(fields)) {
    if (!normalizeKey(key).includes("licens")) continue;
    const text = asText(value).trim();
    if (/^licensed$/i.test(text)) return "Licensed";
    if (/^non[- ]?licensed$/i.test(text)) return "Non-licensed";
  }

  return "";
}

function hasAnyField(fields: Record<string, unknown>, aliases: string[]) {
  const value = findFieldValue(fields, aliases);
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null && value !== false;
}

function daysSince(value?: string) {
  if (!value) return 0;
  const entered = new Date(value);
  if (Number.isNaN(entered.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - entered.getTime()) / 86400000));
}

function missingFromFields(fields: Record<string, unknown>): string[] {
  const explicit = findFieldValue(fields, ["Missing Fields", "Missing Info", "Missing Information"]);
  if (Array.isArray(explicit)) return explicit.map(String);
  if (typeof explicit === "string" && explicit.trim()) {
    return explicit.split(",").map(v => v.trim()).filter(Boolean);
  }

  const required: Array<[string, string[]]> = [
    ["SSN", ["SSN", "Social Security Number", "Social Security #"]],
    ["DOB", ["DOB", "Date of Birth", "Birth Date", "Birthday"]],
    ["Discord", ["Discord", "Discord Username", "Discord Name"]],
    ["PDB", ["PDB", "PDB Report", "PDB Status", "NIPR PDB"]],
    ["NPN", ["NPN", "National Producer Number"]],
  ];

  return required
    .filter(([, aliases]) => !hasAnyField(fields, aliases))
    .map(([label]) => label);
}

async function fetchAllAirtableRecords(
  baseId: string,
  table: string,
  token: string,
  viewId?: string,
) {
  const records: Array<{ id: string; fields: Record<string, unknown> }> = [];
  let offset: string | undefined;

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");

    // Pull from the exact Airtable view the operations team uses.
    // The dashboard then applies its own Status/Licensing logic locally.
    if (viewId) url.searchParams.set("view", viewId);
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
      records: Array<{ id: string; fields: Record<string, unknown> }>;
      offset?: string;
    };

    records.push(...json.records);
    offset = json.offset;
  } while (offset);

  return records;
}

export async function getDashboardData(): Promise<DashboardData> {
  const token = process.env.AIRTABLE_PAT;
  const baseId = "app5eoO1QYp4UAoaU";
  const table = process.env.AIRTABLE_TABLE_ID || process.env.AIRTABLE_AGENTS_TABLE || "tblx66f77FNlyJ3m4";
  const viewId = process.env.AIRTABLE_VIEW_ID || "viwpOLkjUUwe9tviQ";

  if (!token) return { agents: sampleAgents, source: "sample" };

  try {
    const records = await fetchAllAirtableRecords(baseId, table, token, viewId);
    const activeRecords = records.filter(record => asText(record.fields["Status"]).trim().toLowerCase() === "active");

    const agents: Agent[] = activeRecords.map(record => {
      const f = record.fields;
      const rawStage = asText(f["Stage"] || f["Pipeline Stage"]) as PipelineStage;
      const stage: PipelineStage = allowedStages.includes(rawStage) ? rawStage : "Pre-Licensing";
      const entered = asText(f["Stage Entered Date"]);
      const licensingStatus = findLicensingStatus(f);

      return {
        id: record.id,
        name: asText(f["Name"] || f["Agent Name"]) || "Unnamed agent",
        email: asText(f["Email"] || f["Personal email"] || f["PHS Email"]),
        status: asText(findFieldValue(f, ["Status"])),
        role: asText(findFieldValue(f, ["Role", "Position", "Job Role"])),
        currentStage: asText(findFieldValue(f, ["Current Stage", "Stage", "Pipeline Stage"])),
        stage,
        subStage: asText(f["Sub-Stage"] || f["Sub Stage"]),
        stageEnteredDate: entered || undefined,
        daysInStage: Number(f["Days in Stage"]) || daysSince(entered),
        owner: asText(f["Owner"] || f["Assigned To"]),
        blocker: asText(f["Blocker Details"] || f["Blocker"]),
        blockerType: asText(f["Blocker Status"] || f["Blocker Type"]),
        missingFields: missingFromFields(f),
        licenseExpiry: asText(f["License Expiration"] || f["License Expiry"]) || undefined,
        hierarchyVerified: Boolean(f["Hierarchy Verified"]),
        carrierSummary: asText(f["Carrier RTS Summary"] || f["RTS Summary"]),
        ceDueDate: asText(f["CE Due Date"]) || undefined,
        licensingStatus: licensingStatus || undefined,
      };
    });

    return { agents, source: "airtable" };
  } catch (error) {
    console.error("Airtable load failed", error);
    const message = error instanceof Error ? error.message : "Unknown Airtable error";
    return { agents: [], source: "error", error: message };
  }
}
