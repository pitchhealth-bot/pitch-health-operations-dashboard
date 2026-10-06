import { unstable_cache } from "next/cache";

export type LicenseRecord = {
  id: string;
  agentName?: string;
  email?: string;
  npn?: string;
  state?: string;
  licenseNumber?: string;
  expirationDate?: string;
  status?: string;
};

function asText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (Array.isArray(value)) return value.map(String).join(", ").trim();
  return "";
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findField(fields: Record<string, unknown>, aliases: string[]) {
  const wanted = aliases.map(normalizeKey);
  for (const [key, value] of Object.entries(fields)) {
    if (wanted.includes(normalizeKey(key))) return value;
  }
  return undefined;
}

async function loadLicenseRecords(): Promise<{
  records: LicenseRecord[];
  error?: string;
}> {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_LICENSE_BASE_ID || "appkh89p5kYTMEWwQ";
  const tableId = process.env.AIRTABLE_LICENSE_TABLE_ID || "tblOYpNBFudPnDxM1";
  const viewId = process.env.AIRTABLE_LICENSE_VIEW_ID || "viwsB328f5JKitgxH";

  if (!token) return { records: [], error: "AIRTABLE_PAT missing" };

  const records: Array<{ id: string; fields: Record<string, unknown> }> = [];
  let offset: string | undefined;

  try {
    do {
      const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
      url.searchParams.set("pageSize", "100");
      url.searchParams.set("view", viewId);
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

    return {
      records: records.map(record => {
        const f = record.fields;

        return {
          id: record.id,
          agentName: asText(findField(f, ["Name","Agent Name","Agent"])),
          email: asText(findField(f, ["PHS Email","Work Email","Email","Personal Email"])),
          npn: asText(findField(f, ["NPN","National Producer Number"])),
          state: asText(findField(f, ["State","License State","Licensed State"])),
          licenseNumber: asText(findField(f, ["License Number","License #","License No","License No.","State License Number"])),
          expirationDate: asText(findField(f, [
            "Expiration Date",
            "License Expiration",
            "License Expiry",
            "Expiration",
            "Expiry Date",
            "Expiration Date (License)"
          ])),
          status: asText(findField(f, ["Status","License Status"])),
        };
      }),
    };
  } catch (error) {
    return {
      records: [],
      error: error instanceof Error ? error.message : "Unknown license Airtable error",
    };
  }
}

export function daysUntil(date?: string) {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.ceil((parsed.getTime() - Date.now()) / 86400000);
}


export function residentStateFromValue(value?: string) {
  if (!value) return "";
  const match = value.trim().match(/^resident\s*[-:]?\s*(.+)$/i);
  return match ? match[1].trim() : "";
}

export function displayLicenseState(value?: string) {
  if (!value) return "";
  return residentStateFromValue(value) || value.trim();
}


export const getLicenseRecords = unstable_cache(
  loadLicenseRecords,
  ["pitch-license-records-v2"],
  { revalidate: 30, tags: ["licenses-data"] },
);


export const TRACKED_LICENSE_STATES = new Set([
  "IA","FL","AL","AZ","GA","IL","IN","LA","MI","MO",
  "MS","NC","NM","OH","OK","PA","SC","TN","VA","TX",
]);

export function normalizedLicenseState(value?: string) {
  if (!value) return "";
  return (residentStateFromValue(value) || value).trim().toUpperCase();
}

export function isTrackedLicenseState(value?: string) {
  const state = normalizedLicenseState(value);
  return Boolean(state && TRACKED_LICENSE_STATES.has(state));
}
