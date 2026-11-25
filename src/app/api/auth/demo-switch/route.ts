import { handleApiError, jsonError, jsonOk } from "@/lib/api-response";
import { DEMO_ACCOUNTS } from "@/lib/demo-users";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoSwitchSchema } from "@/lib/validations/auth";

export async function GET() {
  return jsonOk({
    accounts: DEMO_ACCOUNTS,
    supabaseConfigured: isSupabaseConfigured(),
  });
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return jsonError(
        "Supabase environment variables are not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        503
      );
    }

    const body = await request.json();
    const { email } = demoSwitchSchema.parse(body);

    const password = process.env.DEMO_USER_PASSWORD || "AjaiaDemo123!";
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return jsonError(
        error?.message ||
          "Demo login failed. Ensure supabase/seed.sql has been applied to your Supabase database.",
        401
      );
    }

    const matchedDemo = DEMO_ACCOUNTS.find((acct) => acct.email === email);

    return jsonOk({
      user: {
        id: data.user.id,
        email: data.user.email ?? email,
        fullName:
          (data.user.user_metadata?.full_name as string | undefined) ??
          matchedDemo?.fullName ??
          null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

