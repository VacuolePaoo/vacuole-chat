"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Lock, LogOut } from "lucide-react"
import { useUser } from "@/contexts/user-context"
import { createClientSupabaseClient } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"

export function PageLock() {
  const [isLocked, setIsLocked] = useState(false)
  const [pin, setPin] = useState<string[]>(Array(6).fill(""))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { user, logout } = useUser()
  const supabase = createClientSupabaseClient()
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])
  const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 检查页面是否应该锁定
  useEffect(() => {
    if (!user) return

    let lastActivity = Date.now()

    // 更新最后活动时间
    const updateLastActivity = () => {
      lastActivity = Date.now()

      // 如果页面已锁定，不要重置计时器
      if (isLocked) return

      // 重置计时器
      if (lockTimeoutRef.current) {
        clearTimeout(lockTimeoutRef.current)
      }

      // 获取用户设置的锁定时间（秒）
      const lockTimeInSeconds = user.lock_time ? Number.parseInt(user.lock_time) : 60

      // 如果锁定时间设置为0，表示永不锁定
      if (lockTimeInSeconds === 0) return

      // 设置新的计时器
      lockTimeoutRef.current = setTimeout(checkInactivity, 5000) // 每5秒检查一次
    }

    // 检查不活动时间
    const checkInactivity = () => {
      const inactiveTime = Date.now() - lastActivity

      // 获取用户设置的锁定时间（毫秒）
      const lockTimeInMs = (user.lock_time ? Number.parseInt(user.lock_time) : 60) * 1000

      // 如果锁定时间设置为0，表示永不锁定
      if (lockTimeInMs === 0) return

      // 如果不活动时间超过设定时间，锁定页面
      if (inactiveTime >= lockTimeInMs) {
        lockPage()
      } else {
        // 继续检查
        lockTimeoutRef.current = setTimeout(checkInactivity, 5000)
      }
    }

    // 锁定页面
    const lockPage = () => {
      setIsLocked(true)
      document.title = "已锁定 - 聊天室"
    }

    // 监听用户活动
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"]
    events.forEach((event) => {
      document.addEventListener(event, updateLastActivity)
    })

    // 初始化计时器
    updateLastActivity()

    // 页面可见性变化时检查
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const inactiveTime = Date.now() - lastActivity
        const lockTimeInMs = (user.lock_time ? Number.parseInt(user.lock_time) : 60) * 1000

        // 如果锁定时间设置为0，表示永不锁定
        if (lockTimeInMs === 0) return

        if (inactiveTime >= lockTimeInMs) {
          lockPage()
        } else {
          updateLastActivity()
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    // 清理函数
    return () => {
      if (lockTimeoutRef.current) {
        clearTimeout(lockTimeoutRef.current)
      }
      events.forEach((event) => {
        document.removeEventListener(event, updateLastActivity)
      })
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [user, isLocked])

  // 当PIN码填满时自动验证
  useEffect(() => {
    const fullPin = pin.join("")
    if (fullPin.length === 6) {
      handleUnlock()
    }
  }, [pin])

  // 处理输入变化
  const handleInputChange = (index: number, value: string) => {
    if (/^\d*$/.test(value)) {
      setPin((prev) => {
        const newValues = [...prev]
        newValues[index] = value.slice(0, 1)
        return newValues
      })

      // 自动跳到下一个输入框
      if (value && index < 5) {
        pinRefs.current[index + 1]?.focus()
      }
    }
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !e.currentTarget.value) {
      // 当前输入框为空且按下退格键时，移动到前一个输入框
      if (index > 0) {
        pinRefs.current[index - 1]?.focus()
      }
    } else if (e.key === "ArrowLeft") {
      if (index > 0) {
        pinRefs.current[index - 1]?.focus()
      }
    } else if (e.key === "ArrowRight") {
      if (index < 5) {
        pinRefs.current[index + 1]?.focus()
      }
    }
  }

  // 解锁页面
  const handleUnlock = async () => {
    if (!user || isSubmitting) return

    const fullPin = pin.join("")
    if (fullPin.length !== 6) return

    setIsSubmitting(true)

    try {
      // 验证PIN码
      const { data, error } = await supabase.from("users").select("id").eq("id", user.id).eq("pin", fullPin).single()

      if (error || !data) {
        toast({
          title: "PIN码错误",
          description: "请输入正确的PIN码",
          variant: "destructive",
        })
        // 清空PIN码
        setPin(Array(6).fill(""))
        pinRefs.current[0]?.focus()
        setIsSubmitting(false)
        return
      }

      // 解锁页面
      setIsLocked(false)
      setPin(Array(6).fill(""))
      document.title = "在线聊天室"
    } catch (error) {
      console.error("Error unlocking page:", error)
      toast({
        title: "解锁失败",
        description: "请重试",
        variant: "destructive",
      })
      // 清空PIN码
      setPin(Array(6).fill(""))
      pinRefs.current[0]?.focus()
    } finally {
      setIsSubmitting(false)
    }
  }

  // 退出登录
  const handleLogout = () => {
    logout()
  }

  if (!isLocked || !user) return null

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">页面已锁定</CardTitle>
          <CardDescription>请输入PIN码解锁</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-primary/10 mb-4">
              <Lock className="h-10 w-10 text-primary" />
            </div>
            <div className="text-lg font-medium">{user.username}</div>
            <div className="text-sm text-muted-foreground">ID: {user.id}</div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {Array(6)
                .fill(0)
                .map((_, i) => (
                  <Input
                    key={`pin-${i}`}
                    ref={(el) => (pinRefs.current[i] = el)}
                    type="password"
                    inputMode="numeric"
                    value={pin[i]}
                    onChange={(e) => handleInputChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                    className="w-12 h-12 text-center text-lg font-medium"
                    maxLength={1}
                    autoFocus={i === 0}
                    disabled={isSubmitting}
                  />
                ))}
            </div>

            <div className="flex gap-4">
              <Button variant="outline" className="w-full" onClick={handleLogout} disabled={isSubmitting}>
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </Button>
              <Button
                type="button"
                className="w-full"
                onClick={handleUnlock}
                disabled={isSubmitting || pin.join("").length !== 6}
              >
                {isSubmitting ? "验证中..." : "解锁"}
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="text-center text-sm text-muted-foreground">页面因长时间未活动而锁定</CardFooter>
      </Card>
    </div>
  )
}
