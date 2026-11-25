import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const configured = isSupabaseConfigured();

  if (!configured) {
    return NextResponse.json({
      status: "ok",
      service: "ajaia-docs",
      supabaseConfigured: false,
      database: "unconfigured",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("documents").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        {
          status: "degraded",
          service: "ajaia-docs",
          supabaseConfigured: true,
          database: "error",
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "ok",
      service: "ajaia-docs",
      supabaseConfigured: true,
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        service: "ajaia-docs",
        supabaseConfigured: true,
        database: "unreachable",
        error: err instanceof Error ? err.message : "Database check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
