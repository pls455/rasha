import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(values) {
          for (const { name, value, options } of values) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}

/** Server-only privileged client. Never import this module into a client component. */
export function createSupabaseServiceClient(): SupabaseClient {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}

export interface ActiveAdmin {
  userId: string;
  displayName: string | null;
}

/** Validates the Supabase session server-side, then checks the single allowlisted admin row. */
export async function getActiveAdmin(): Promise<ActiveAdmin | null> {
  const authClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return null;

  const serviceClient = createSupabaseServiceClient();
  const { data, error } = await serviceClient
    .from("admin_users")
    .select("user_id,display_name,is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return { userId: data.user_id, displayName: data.display_name };
}
