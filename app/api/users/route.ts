import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAuthConfigured } from "@/lib/access";
import {
  getDashboardUserByEmail,
  createDashboardUser,
  updateDashboardUser,
  listDashboardUsers,
} from "@/lib/users";

async function requireSuperAdminJson() {
  if (!isAuthConfigured()) {
    return {
      error: NextResponse.json(
        { error: "Google authentication is not configured yet." },
        { status: 401 },
      ),
    };
  }

  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
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

  return { session, current };
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

    // Safe one-time bootstrap before Google OAuth is configured.
    if (!isAuthConfigured()) {
      const existingUsers = await listDashboardUsers();

      if (existingUsers.length > 0) {
        return NextResponse.json(
          {
            error:
              "The first Super Admin already exists. Configure Google sign-in before managing additional users.",
          },
          { status: 403 },
        );
      }

      if (body.role !== "super_admin" || body.status !== "active") {
        return NextResponse.json(
          {
            error:
              "The first dashboard user must be an Active Super Admin.",
          },
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

      return NextResponse.json({
        user: created,
        bootstrap: true,
      });
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
