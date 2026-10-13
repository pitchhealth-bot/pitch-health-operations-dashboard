import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSessionEmail } from "@/lib/app-session";
import { canEdit } from "@/lib/access";
import { getDashboardUserByEmail } from "@/lib/users";
import { getDashboardData } from "@/lib/airtable";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { updateCertificationDocumentForAgent, type CertificationDocumentKind } from "@/lib/contracting";
import { writeAuditEntry } from "@/lib/audit";

const BUCKET = "employee-certifications";
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const dashboardUser = await getDashboardUserByEmail(sessionEmail);
  if (!dashboardUser || dashboardUser.status !== "active" || !canEdit(dashboardUser.role)) {
    return NextResponse.json({ error: "You do not have permission to edit certifications." }, { status: 403 });
  }

  const { id } = await context.params;
  const { agents } = await getDashboardData();
  const agent = agents.find(item => item.id === id);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") || "") as CertificationDocumentKind;
  const removeAttachmentIds = form
    .getAll("removeAttachmentId")
    .map(value => String(value))
    .filter(Boolean);

  const hasFile = file instanceof File && file.size > 0;

  if (!hasFile && removeAttachmentIds.length === 0) {
    return NextResponse.json(
      { error: "Choose a file or remove an existing attachment." },
      { status: 400 },
    );
  }

  if (kind !== "ahip2027" && kind !== "sunfire") {
    return NextResponse.json({ error: "Unsupported certification type." }, { status: 400 });
  }

  if (hasFile && !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only PDF, PNG, JPG, and JPEG files are supported." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  let storagePath = "";
  let signedUrl = "";
  let uploadedFileName = "";

  if (hasFile) {
    storagePath = [
      id,
      kind,
      `${Date.now()}-${safeFileName(file.name)}`,
    ].join("/");

    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60);

    if (signedError) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json({ error: signedError.message }, { status: 500 });
    }

    signedUrl = signed.signedUrl;
    uploadedFileName = file.name;
  }

  try {
    const result = await updateCertificationDocumentForAgent({
      email: agent.email,
      name: agent.name,
      kind,
      fileUrl: signedUrl || undefined,
      fileName: uploadedFileName || undefined,
      removeAttachmentIds,
    });

    await writeAuditEntry({
      userEmail: dashboardUser.email,
      userName: dashboardUser.name || "",
      role: dashboardUser.role,
      action: "Updated certification document",
      entityType: "Agent",
      entityId: agent.id,
      entityName: agent.name,
      field: result.fieldName,
      oldValue: removeAttachmentIds.length
        ? `Removed ${removeAttachmentIds.length} attachment${removeAttachmentIds.length === 1 ? "" : "s"}`
        : "",
      newValue: uploadedFileName || "Attachment removed",
    }).catch(() => undefined);

    revalidateTag("contracting-data", "max");
    revalidateTag("contracting-table-1", "max");

    return NextResponse.json({
      ok: true,
      kind,
      file: hasFile
        ? {
            filename: uploadedFileName,
            url: signedUrl,
            type: file.type,
            size: file.size,
          }
        : null,
      attachments: result.attachments,
      fieldName: result.fieldName,
    });
  } catch (error) {
    if (storagePath) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update certification." },
      { status: 500 },
    );
  }
}
