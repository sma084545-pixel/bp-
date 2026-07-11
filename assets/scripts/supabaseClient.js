import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://bwlcnaruyjazaxyiiumd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_bGhQso88Ml6VEpX4reo8QQ_VjwL7yND";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
