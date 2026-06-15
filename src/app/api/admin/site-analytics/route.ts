import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasSuperAdminAccess } from "@/lib/admin";
import { getSiteAnalyticsDashboard } from "@/lib/siteAnalytics";
import { SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email ?? "";

  if (!(await hasSuperAdminAccess(email))) {
    return NextResponse.json(
      { error: "Super-admin access required.", debugCode: "SITE_ANALYTICS_FORBIDDEN" },
      { status: 403 }
    );
  }

  try {
    return NextResponse.json(await getSiteAnalyticsDashboard());
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json(
        {
          error: "Site analytics storage is not configured yet.",
          debugCode: "SITE_ANALYTICS_SUPABASE_CONFIG_MISSING"
        },
        { status: 503 }
      );
    }

    if (error instanceof SupabaseRequestError) {
      console.error("Site analytics Supabase error", {
        message: error.message,
        status: error.status
      });

      return NextResponse.json(
        {
          error: "Site analytics tables are not ready yet.",
          debugCode:
            error.status === 404
              ? "SITE_ANALYTICS_TABLES_NOT_READY"
              : "SITE_ANALYTICS_SUPABASE_REQUEST_FAILED"
        },
        { status: 503 }
      );
    }

    console.error("Site analytics API error", error);
    return NextResponse.json(
      {
        error: "Site analytics are temporarily unavailable.",
        debugCode: "SITE_ANALYTICS_UNAVAILABLE"
      },
      { status: 500 }
    );
  }
}
