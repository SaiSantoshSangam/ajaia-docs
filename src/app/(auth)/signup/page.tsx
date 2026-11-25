import { AuthForm } from "@/components/auth/auth-form";
import { isSupabaseConfigured } from "@/lib/env";

export default function SignupPage() {
  return (
    <AuthForm mode="signup" supabaseConfigured={isSupabaseConfigured()} />
  );
}
