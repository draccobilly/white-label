"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  async function signOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      /* still leave the panel */
    }
    window.location.assign("/login");
  }

  return (
    <button type="button" onClick={() => void signOut()}>
      <LogOut size={16} aria-hidden />
      Sign out
    </button>
  );
}
