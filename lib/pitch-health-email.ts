function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function pitchHealthEmailHtml(input: {
  name?: string;
  role: Role;
  actionUrl: string;
  type: "invite" | "signin";
}) {
  const name = escapeHtml(input.name?.trim() || "there");
  const role = ROLE_LABELS[input.role];
  const actionUrl = escapeHtml(input.actionUrl);
  const isInvite = input.type === "invite";

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f8;font-family:Arial,Helvetica,sans-serif;color:#18161f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f8;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #eceaf2;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px rgba(44,32,84,.06);">
            <tr>
              <td style="height:6px;background:#5634d6;font-size:0;line-height:0;">&nbsp;</td>
            </tr>

            <tr>
              <td style="padding:30px 34px 10px;text-align:center;">
                <img
                  src="https://pitch-health-operations-dashboard.vercel.app/api/email-assets/pitch-health-banner"
                  alt="Pitch Health Solutions"
                  width="420"
                  style="display:block;margin:0 auto;max-width:420px;width:100%;height:auto;border:0;"
                />
              </td>
            </tr>

            <tr>
              <td style="padding:18px 38px 36px;">
                <div style="font-size:10px;letter-spacing:2.2px;font-weight:800;color:#5634d6;text-transform:uppercase;margin-bottom:12px;">
                  Pitch Health Operations
                </div>

                <h1 style="margin:0 0 16px;font-size:28px;line-height:1.18;letter-spacing:-.4px;color:#18161f;">
                  ${isInvite ? "You’re invited" : "Your sign-in link"}
                </h1>

                <p style="font-size:15px;line-height:1.65;color:#686472;margin:0 0 12px;">
                  Hi ${name},
                </p>

                <p style="font-size:15px;line-height:1.65;color:#686472;margin:0 0 20px;">
                  ${
                    isInvite
                      ? "You’ve been granted access to the Pitch Health Operations dashboard."
                      : "Use the secure button below to sign in to Pitch Health Operations."
                  }
                </p>

                ${
                  isInvite
                    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                        <tr>
                          <td style="background:#f3efff;border:1px solid #e2dafd;border-radius:999px;padding:8px 13px;">
                            <span style="font-size:12px;font-weight:800;color:#5634d6;">${role}</span>
                          </td>
                        </tr>
                      </table>`
                    : ""
                }

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                  <tr>
                    <td align="center" style="background:#5634d6;border-radius:11px;">
                      <a
                        href="${actionUrl}"
                        style="display:block;padding:15px 20px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;text-align:center;"
                      >
                        ${isInvite ? "Open Pitch Health Operations" : "Sign In to Pitch Health Operations"}
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="border-top:1px solid #efedf3;padding-top:20px;">
                  <p style="font-size:12px;line-height:1.6;color:#9893a2;margin:0 0 6px;">
                    This is a secure, one-time link intended only for you.
                  </p>
                  <p style="font-size:12px;line-height:1.6;color:#9893a2;margin:0;">
                    If you weren’t expecting this email, you can safely ignore it.
                  </p>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 38px 22px;background:#faf9fc;border-top:1px solid #efedf3;">
                <div style="font-size:11px;font-weight:800;color:#3a3640;">Pitch Health Solutions</div>
                <div style="font-size:10px;color:#9b96a4;margin-top:4px;">Operations Dashboard</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function pitchHealthEmailText(input: {
  name?: string;
  role: Role;
  actionUrl: string;
  type: "invite" | "signin";
}) {
  const role = ROLE_LABELS[input.role];

  return input.type === "invite"
    ? `Hi ${input.name || "there"},\n\nYou’ve been invited to Pitch Health Operations as ${role}.\n\nOpen Pitch Health Operations:\n${input.actionUrl}\n\nThis is a secure one-time link.\n\nPitch Health Solutions`
    : `Hi ${input.name || "there"},\n\nUse this secure link to sign in to Pitch Health Operations:\n${input.actionUrl}\n\nThis is a secure one-time link.\n\nPitch Health Solutions`;
}

export async function sendPitchHealthEmail(input: {
  to: string;
  name?: string;
  role: Role;
  actionUrl: string;
  type: "invite" | "signin";
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.PITCH_HEALTH_FROM_EMAIL ||
    "Pitch Health Operations <automations@pitchhealthsolutions.com>";

  if (!apiKey) {
    throw new Error(
      "Branded email sending is wired, but RESEND_API_KEY is missing in Vercel.",
    );
  }

  const subject =
    input.type === "invite"
      ? "You’re invited to Pitch Health Operations"
      : "Your Pitch Health Operations sign-in link";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject,
      html: pitchHealthEmailHtml(input),
      text: pitchHealthEmailText(input),
      attachments: [
        {
          filename: "pitch-health-banner.png",
          content: BANNER_BASE64,
          content_type: "image/png",
          content_id: "pitch-health-banner",
        },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email provider returned ${response.status}: ${detail}`);
  }

  return response.json();
}
