"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ImageIcon, X } from "lucide-react"
import { createClientSupabaseClient } from "@/lib/supabase"
import { useUser } from "@/contexts/user-context"
import { toast } from "@/hooks/use-toast"

interface ImageUploadProps {
  onImageUploaded: (url: string) => void
  bucket: "avatars" | "chat_images"
  previewUrl?: string | null
  onClear?: () => void
}

export function ImageUpload({ onImageUploaded, bucket, previewUrl, onClear }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const { user } = useUser()
  const supabase = createClientSupabaseClient()

  // 同步外部传入的预览URL
  useEffect(() => {
    setPreview(previewUrl || null)
  }, [previewUrl])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // 验证文件类型
    if (!file.type.startsWith("image/")) {
      toast({
        title: "错误",
        description: "请选择图片文件",
        variant: "destructive",
      })
      return
    }

    // 验证文件大小 (最大5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "错误",
        description: "图片大小不能超过5MB",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)

    try {
      // 创建预览
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      // 生成唯一文件名
      const fileExt = file.name.split(".").pop()
      const fileName = `${user.id}_${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      // 上传到Supabase存储
      const { data, error } = await supabase.storage.from(bucket).upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      })

      if (error) throw error

      // 获取公共URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath)

      onImageUploaded(urlData.publicUrl)
    } catch (error) {
      console.error("Upload error:", error)
      toast({
        title: "上传失败",
        description: "图片上传失败，请重试",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const cancelUpload = () => {
    setPreview(null)
    if (onClear) {
      onClear()
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10"
        disabled={isUploading}
        onClick={() => document.getElementById("image-upload")?.click()}
      >
        <ImageIcon className="h-5 w-5" />
        <span className="sr-only">上传图片</span>
      </Button>
      <input
        id="image-upload"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      {preview && (
        <div className="relative">
          <img src={preview || "/placeholder.svg"} alt="Preview" className="h-10 w-10 object-cover rounded" />
          <button
            type="button"
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
            onClick={cancelUpload}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {isUploading && <span className="text-xs text-muted-foreground">上传中...</span>}
    </div>
  )
}
