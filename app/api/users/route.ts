import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/app-session";
import {
  getDashboardUserByEmail,
  createDashboardUser,
  updateDashboardUser,
  listDashboardUsers,
  deleteDashboardUser,
} from "@/lib/users";

async function requireSuperAdminJson() {
  const email = await getSessionEmail();

  if (!email) {
    return {
      error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  const current = await getDashboardUserByEmail(email);
  if (!current || current.status !== "active" || current.role !== "super_admin") {
    return {
      error: NextResponse.json(
        { error: "Super Admin access required." },
        { status: 403 },
      ),
    };
  }

  return { current };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email?: string;
      name?: string;
      role?: "super_admin" | "admin" | "agent";
      status?: "active" | "inactive" | "invited";
      airtableAgentRecordId?: string;
    };

    if (!body.email || !body.role || !body.status) {
      return NextResponse.json(
        { error: "Email, role, and status are required." },
        { status: 400 },
      );
    }

    const existingUsers = await listDashboardUsers();
    const sessionEmail = await getSessionEmail();

    if (!sessionEmail && !existingUsers.some(user => Boolean(user.lastLoginAt))) {
      if (existingUsers.length > 0) {
        return NextResponse.json(
          { error: "Sign in as the existing Super Admin before adding more users." },
          { status: 403 },
        );
      }

      if (body.role !== "super_admin" || body.status !== "active") {
        return NextResponse.json(
          { error: "The first dashboard user must be an Active Super Admin." },
          { status: 400 },
        );
      }

      const created = await createDashboardUser({
        email: body.email,
        name: body.name,
        role: "super_admin",
        status: "active",
        createdByEmail: "setup-bootstrap",
      });

      return NextResponse.json({ user: created, bootstrap: true });
    }

    const access = await requireSuperAdminJson();
    if ("error" in access) return access.error;

    const created = await createDashboardUser({
      email: body.email,
      name: body.name,
      role: body.role,
      status: body.status,
      airtableAgentRecordId:
        body.role === "agent" ? body.airtableAgentRecordId : undefined,
      createdByEmail: access.current.email,
    });

    return NextResponse.json({ user: created });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not create user.",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const access = await requireSuperAdminJson();
  if ("error" in access) return access.error;

  try {
    const body = await request.json() as {
      id?: string;
      email?: string;
      name?: string;
      role?: "super_admin" | "admin" | "agent";
      status?: "active" | "inactive" | "invited";
      airtableAgentRecordId?: string | null;
    };

    if (!body.id) {
      return NextResponse.json(
        { error: "User ID is required." },
        { status: 400 },
      );
    }

    const isSelf =
      body.email?.trim().toLowerCase() === access.current.email.toLowerCase();

    if (isSelf && body.role && body.role !== "super_admin") {
      return NextResponse.json(
        { error: "You cannot remove your own Super Admin role." },
        { status: 400 },
      );
    }

    if (isSelf && body.status && body.status !== "active") {
      return NextResponse.json(
        { error: "You cannot deactivate your own account." },
        { status: 400 },
      );
    }

    const updated = await updateDashboardUser(body.id, {
      name: body.name,
      role: body.role,
      status: body.status,
      airtableAgentRecordId:
        body.role === "agent" ? body.airtableAgentRecordId || null : null,
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update user.",
      },
      { status: 400 },
    );
  }
}


export async function DELETE(request: Request) {
  const access = await requireSuperAdminJson();
  if ("error" in access) return access.error;

  try {
    const body = await request.json() as {
      id?: string;
      mode?: "revoke" | "delete";
    };

    if (!body.id || !body.mode) {
      return NextResponse.json(
        { error: "User ID and action are required." },
        { status: 400 },
      );
    }

    const users = await listDashboardUsers();
    const target = users.find(user => user.id === body.id);

    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (target.email.toLowerCase() === access.current.email.toLowerCase()) {
      return NextResponse.json(
        { error: "You cannot revoke or delete your own access." },
        { status: 400 },
      );
    }

    const activeSuperAdmins = users.filter(
      user => user.role === "super_admin" && user.status === "active",
    );

    if (
      target.role === "super_admin" &&
      target.status === "active" &&
      activeSuperAdmins.length <= 1
    ) {
      return NextResponse.json(
        { error: "You cannot remove the last active Super Admin." },
        { status: 400 },
      );
    }

    if (body.mode === "revoke") {
      const updated = await updateDashboardUser(target.id, {
        status: "inactive",
      });
      return NextResponse.json({ ok: true, user: updated, mode: "revoke" });
    }

    await deleteDashboardUser(target.id);
    return NextResponse.json({ ok: true, id: target.id, mode: "delete" });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not update access.",
      },
      { status: 400 },
    );
  }
}
