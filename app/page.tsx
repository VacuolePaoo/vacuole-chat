"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useUser } from "@/contexts/user-context"
import { toast } from "@/hooks/use-toast"

export default function LoginPage() {
  const router = useRouter()
  const { login, user } = useUser()
  const [userId, setUserId] = useState<string[]>(Array(4).fill(""))
  const [pin, setPin] = useState<string[]>(Array(6).fill(""))
  const [isLoading, setIsLoading] = useState(false)
  const userIdRefs = useRef<(HTMLInputElement | null)[]>([])
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])

  // 如果用户已登录，重定向到欢迎页面
  useEffect(() => {
    if (user) {
      router.push("/welcome")
    }
  }, [user, router])

  // 当用户ID填满时自动跳转到PIN码输入
  useEffect(() => {
    const fullUserId = userId.join("")
    if (fullUserId.length === 4) {
      pinRefs.current[0]?.focus()
    }
  }, [userId])

  // 当PIN码填满时自动尝试登录
  useEffect(() => {
    const fullPin = pin.join("")
    if (fullPin.length === 6) {
      handleLogin()
    }
  }, [pin])

  const handleLogin = async () => {
    const fullUserId = userId.join("")
    const fullPin = pin.join("")

    // 数据库中ID已经改为4位，不再去除前导零
    if (fullUserId.length === 4 && fullPin.length === 6 && !isLoading) {
      setIsLoading(true)
      try {
        const result = await login(fullUserId, fullPin)
        if (result.success) {
          router.push("/welcome")
        } else {
          toast({
            title: "登录失败",
            description: result.error || "用户ID或PIN码不正确",
            variant: "destructive",
          })
          // 清空PIN码，保留用户ID
          setPin(Array(6).fill(""))
          pinRefs.current[0]?.focus()
        }
      } catch (error) {
        toast({
          title: "登录失败",
          description: "发生错误，请重试",
          variant: "destructive",
        })
        // 清空PIN码，保留用户ID
        setPin(Array(6).fill(""))
        pinRefs.current[0]?.focus()
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleInputChange = (
    index: number,
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    maxLength: number,
    nextRefs?: React.MutableRefObject<(HTMLInputElement | null)[]>,
  ) => {
    if (/^\d*$/.test(value)) {
      setter((prev) => {
        const newValues = [...prev]
        newValues[index] = value.slice(0, 1)
        return newValues
      })

      // 自动跳到下一个输入框
      if (value && index < maxLength - 1) {
        refs.current[index + 1]?.focus()
      } else if (value && index === maxLength - 1 && nextRefs) {
        nextRefs.current[0]?.focus()
      }
    }
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    prevRefs?: React.MutableRefObject<(HTMLInputElement | null)[]>,
    prevLength?: number,
  ) => {
    if (e.key === "Backspace" && !e.currentTarget.value) {
      // 当前输入框为空且按下退格键时，移动到前一个输入框
      if (index > 0) {
        refs.current[index - 1]?.focus()
      } else if (index === 0 && prevRefs && prevLength) {
        prevRefs.current[prevLength - 1]?.focus()
      }
    } else if (e.key === "ArrowLeft") {
      if (index > 0) {
        refs.current[index - 1]?.focus()
      } else if (index === 0 && prevRefs && prevLength) {
        prevRefs.current[prevLength - 1]?.focus()
      }
    } else if (e.key === "ArrowRight") {
      if (index < refs.current.length - 1) {
        refs.current[index + 1]?.focus()
      }
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-left">
          <CardTitle className="text-4xl font-bold">VCHAT</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-left space-x-2">
            {Array(4)
              .fill(0)
              .map((_, i) => (
                <Input
                  key={`userId-${i}`}
                  ref={(el) => (userIdRefs.current[i] = el)}
                  type="password"
                  inputMode="numeric"
                  value={userId[i]}
                  onChange={(e) => handleInputChange(i, e.target.value, setUserId, userIdRefs, 4, pinRefs)}
                  onKeyDown={(e) => handleKeyDown(e, i, userIdRefs)}
                  className="w-10 h-10 text-center text-xl font-medium p-0"
                  autoFocus={i === 0}
                  maxLength={1}
                  disabled={isLoading}
                />
              ))}
          </div>

          <div className="flex justify-left gap-2 flex-wrap">
            {Array(6)
              .fill(0)
              .map((_, i) => (
                <Input
                  key={`pin-${i}`}
                  ref={(el) => (pinRefs.current[i] = el)}
                  type="password"
                  inputMode="numeric"
                  value={pin[i]}
                  onChange={(e) => handleInputChange(i, e.target.value, setPin, pinRefs, 6)}
                  onKeyDown={(e) => handleKeyDown(e, i, pinRefs, userIdRefs, 4)}
                  className="w-10 h-10 text-center text-lg font-medium p-0"
                  maxLength={1}
                  disabled={isLoading}
                />
              ))}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            size="lg"
            onClick={handleLogin}
            disabled={isLoading || userId.join("").length !== 4 || pin.join("").length !== 6}
          >
            {isLoading ? "LOGINING... " : "LOGIN"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
