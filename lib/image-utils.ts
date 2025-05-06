import { createClientSupabaseClient } from "@/lib/supabase"

// 获取带有访问令牌的图片URL
export const getImageUrl = async (bucket: string, path: string | null): Promise<string> => {
  if (!path) return "/placeholder.svg"

  try {
    const supabase = createClientSupabaseClient()

    // 如果是完整URL，尝试提取路径部分
    if (path.startsWith("http")) {
      // 尝试从URL中提取文件路径
      const match = path.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/)
      if (match && match[1]) {
        const filePath = match[1].split("?")[0] // 移除查询参数
        const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
        return data.publicUrl
      }

      // 如果无法提取，返回原始路径
      return path
    }

    // 如果是相对路径，直接获取公共URL
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  } catch (error) {
    console.error("Error getting image URL:", error)
    return "/placeholder.svg" // 返回占位图像作为回退
  }
}

// 获取带签名的URL
export const getSignedUrl = async (bucket: string, path: string | null): Promise<string> => {
  if (!path) return "/placeholder.svg"

  try {
    const supabase = createClientSupabaseClient()

    // 如果是完整URL，尝试提取路径部分
    let filePath = path
    if (path.startsWith("http")) {
      // 尝试从URL中提取文件路径
      const match = path.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/)
      if (match && match[1]) {
        filePath = match[1].split("?")[0] // 移除查询参数
      } else {
        // 如果无法提取，返回公共URL
        return path
      }
    }

    // 尝试获取带签名的URL
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 3600)

    if (error) {
      console.warn("Error creating signed URL, falling back to public URL:", error)
      // 如果获取签名URL失败，尝试获取公共URL
      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath)
      return publicUrlData.publicUrl
    }

    return data.signedUrl
  } catch (error) {
    console.error("Error getting signed URL:", error)
    // 尝试返回公共URL作为回退
    try {
      const supabase = createClientSupabaseClient()
      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(path.startsWith("http") ? path.split("/").pop()?.split("?")[0] || path : path)
      return data.publicUrl
    } catch (e) {
      // 如果所有尝试都失败，返回占位图像
      return "/placeholder.svg"
    }
  }
}
