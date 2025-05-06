import { createClient } from "@supabase/supabase-js"

// 为服务端创建客户端
export const createServerSupabaseClient = () => {
  return createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_ANON_KEY || "")
}

// 为客户端创建单例客户端
let supabaseClient: ReturnType<typeof createClient> | null = null

export const createClientSupabaseClient = () => {
  if (supabaseClient) return supabaseClient

  supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  )

  return supabaseClient
}
