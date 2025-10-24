/**
 * Supabase Browser Client
 *
 * Use this client for client-side operations (Client Components)
 */

import { createBrowserClient } from '@supabase/ssr';
import { config } from '@/lib/config';
import type { Database } from '@/types/database';

export function createClient() {
  return createBrowserClient<Database>(
    config.supabase.url,
    config.supabase.anonKey
  );
}

// Export singleton instance for convenience
export const supabase = createClient();
