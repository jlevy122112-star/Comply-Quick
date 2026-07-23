"use server";

import { createClient } from "@/lib/supabase/server";

export async function resetPasswordAction(password: string): Promise<{ error?: string }> {
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return {};
}
