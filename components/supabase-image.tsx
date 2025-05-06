"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { getSignedUrl } from "@/lib/image-utils"

// 创建一个简单的图片缓存
const imageCache = new Map<string, string>()

interface SupabaseImageProps {
  src: string | null
  bucket: "avatars" | "chat_images"
  alt: string
  className?: string
  style?: React.CSSProperties
  fallback?: string
}

export function SupabaseImage({
  src,
  bucket,
  alt,
  className,
  style,
  fallback = "/placeholder.svg",
}: SupabaseImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(fallback)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!src) {
      setImageSrc(fallback)
      setIsLoading(false)
      return
    }

    const cacheKey = `${bucket}:${src}`

    // 检查缓存中是否有图片
    if (imageCache.has(cacheKey)) {
      setImageSrc(imageCache.get(cacheKey) || fallback)
      setIsLoading(false)
      return
    }

    const loadImage = async () => {
      try {
        setIsLoading(true)
        setError(false)

        // 首先尝试使用公共URL
        const img = new Image()
        img.src = src

        img.onload = () => {
          setImageSrc(src)
          imageCache.set(cacheKey, src) // 缓存图片URL
          setIsLoading(false)
        }

        img.onerror = async () => {
          try {
            // 如果公共URL加载失败，尝试获取签名URL
            const signedUrl = await getSignedUrl(bucket, src)
            setImageSrc(signedUrl)
            imageCache.set(cacheKey, signedUrl) // 缓存签名URL
            setError(false)
          } catch (err) {
            console.error("Error loading image with signed URL:", err)
            setImageSrc(fallback)
            setError(true)
          } finally {
            setIsLoading(false)
          }
        }
      } catch (err) {
        console.error("Error in image loading process:", err)
        setImageSrc(fallback)
        setError(true)
        setIsLoading(false)
      }
    }

    loadImage()
  }, [src, bucket, fallback])

  return (
    <>
      {isLoading ? (
        <div className={`animate-pulse bg-muted ${className}`} style={style}></div>
      ) : (
        <img
          src={imageSrc || "/placeholder.svg"}
          alt={alt}
          className={className}
          style={style}
          onError={() => {
            if (!error) {
              setImageSrc(fallback)
              setError(true)
            }
          }}
        />
      )}
    </>
  )
}
