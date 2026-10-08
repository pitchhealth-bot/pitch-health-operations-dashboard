type Role = "super_admin" | "admin" | "agent";

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  agent: "Agent",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function brandHeader() {
  return `
    <div style="padding:30px 34px 24px;background:linear-gradient(135deg,#4f2bd0,#7353e8);text-align:left;">
      <div style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
        <div style="font-size:30px;font-weight:900;letter-spacing:-1px;line-height:1;">
          PITCH HEALTH
        </div>
        <div style="font-size:14px;font-weight:700;letter-spacing:5px;margin-top:6px;color:#ded6ff;">
          SOLUTIONS
        </div>
      </div>
    </div>
  `;
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
  <body style="margin:0;padding:0;background:#f4f3f8;font-family:Arial,Helvetica,sans-serif;color:#17141f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f8;padding:36px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px rgba(39,29,76,.08);">
            <tr>
              <td>
                ${brandHeader()}
              </td>
            </tr>
            <tr>
              <td style="padding:38px 38px 32px;">
                <div style="font-size:11px;letter-spacing:2.5px;font-weight:800;color:#5634d6;margin-bottom:12px;">
                  PITCH HEALTH OPERATIONS
                </div>

                <h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;color:#17141f;">
                  ${isInvite ? "You’ve been invited" : "Your secure sign-in link"}
                </h1>

                <p style="font-size:15px;line-height:1.7;color:#676270;margin:0 0 14px;">
                  Hi ${name},
                </p>

                <p style="font-size:15px;line-height:1.7;color:#676270;margin:0 0 18px;">
                  ${
                    isInvite
                      ? `You now have access to the Pitch Health Operations dashboard as <strong style="color:#17141f;">${role}</strong>.`
                      : "Use the secure button below to sign in to Pitch Health Operations."
                  }
                </p>

                ${
                  isInvite
                    ? `<div style="background:#f6f3ff;border:1px solid #e5defd;border-radius:12px;padding:15px 17px;margin:22px 0;">
                        <div style="font-size:11px;color:#8a8297;text-transform:uppercase;letter-spacing:1.5px;font-weight:800;">Access Level</div>
                        <div style="font-size:16px;color:#4f2bd0;font-weight:800;margin-top:5px;">${role}</div>
                      </div>`
                    : ""
                }

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                  <tr>
                    <td style="background:#5634d6;border-radius:10px;">
                      <a href="${actionUrl}" style="display:inline-block;padding:15px 26px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;">
                        ${isInvite ? "Access Pitch Health Operations" : "Sign In to Pitch Health Operations"}
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="font-size:12px;line-height:1.6;color:#96909e;margin:0 0 8px;">
                  This is a secure, one-time sign-in link. If you weren’t expecting this email, you can safely ignore it.
                </p>

                <p style="font-size:12px;line-height:1.6;color:#96909e;margin:0;">
                  For security, do not forward this email or share the access link.
                </p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #eeeaf4;padding:22px 38px 26px;background:#fcfbfe;">
                <div style="font-size:12px;font-weight:800;color:#322d39;">Pitch Health Solutions</div>
                <div style="font-size:11px;color:#9992a2;margin-top:5px;">Operations Dashboard</div>
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
    ? `Hi ${input.name || "there"},\n\nYou’ve been invited to Pitch Health Operations as ${role}.\n\nAccess Pitch Health Operations:\n${input.actionUrl}\n\nThis is a secure one-time link. Do not forward it.\n\nPitch Health Solutions`
    : `Hi ${input.name || "there"},\n\nUse this secure link to sign in to Pitch Health Operations:\n${input.actionUrl}\n\nThis is a secure one-time link. Do not forward it.\n\nPitch Health Solutions`;
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
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email provider returned ${response.status}: ${detail}`);
  }

  return response.json();
}
