"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { createClientSupabaseClient } from "@/lib/supabase"

export type User = {
  id: string
  username: string
  avatar_url: string | null
  bio: string | null
  email: string | null
  created_at: string
  last_seen: string
}

type UserContextType = {
  user: User | null
  loading: boolean
  login: (userId: string, pin: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  updateUserProfile: (data: Partial<User>) => Promise<void>
  updateLastSeen: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClientSupabaseClient()

  useEffect(() => {
    // 从本地存储中检查用户
    const storedUser = localStorage.getItem("chatUser")
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
        updateLastSeen()
      } catch (error) {
        console.error("Failed to parse stored user:", error)
        localStorage.removeItem("chatUser")
      }
    }
    setLoading(false)
  }, [])

  // 定期更新用户在线状态
  useEffect(() => {
    if (!user) return

    // 立即更新一次
    updateLastSeen()

    // 每30秒更新一次在线状态
    const interval = setInterval(() => {
      updateLastSeen()
    }, 30000)

    return () => clearInterval(interval)
  }, [user])

  const login = async (userId: string, pin: string) => {
    try {
      const { data, error } = await supabase.from("users").select("*").eq("id", userId).eq("pin", pin).single()

      if (error || !data) {
        return { success: false, error: "用户ID或PIN码不正确" }
      }

      setUser(data)
      localStorage.setItem("chatUser", JSON.stringify(data))

      // 更新最后在线时间
      await supabase.from("users").update({ last_seen: new Date().toISOString() }).eq("id", userId)

      return { success: true }
    } catch (error) {
      console.error("Login error:", error)
      return { success: false, error: "登录失败，请重试" }
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("chatUser")
    router.push("/")
  }

  const updateUserProfile = async (data: Partial<User>) => {
    if (!user) return

    try {
      const { error } = await supabase.from("users").update(data).eq("id", user.id)

      if (error) throw error

      // 更新本地用户数据
      const updatedUser = { ...user, ...data }
      setUser(updatedUser)
      localStorage.setItem("chatUser", JSON.stringify(updatedUser))
    } catch (error) {
      console.error("Failed to update profile:", error)
      throw error
    }
  }

  const updateLastSeen = async () => {
    if (!user) return

    try {
      await supabase.from("users").update({ last_seen: new Date().toISOString() }).eq("id", user.id)
    } catch (error) {
      console.error("Failed to update last seen:", error)
    }
  }

  return (
    <UserContext.Provider value={{ user, loading, login, logout, updateUserProfile, updateLastSeen }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
