"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LogOut, Save, Upload, Lock, Copy, Check, Clock } from "lucide-react"
import { useUser } from "@/contexts/user-context"
import { createClientSupabaseClient } from "@/lib/supabase"
import { SupabaseImage } from "@/components/supabase-image"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function ProfilePage() {
  const { user, logout, updateUserProfile } = useUser()
  const [formData, setFormData] = useState({
    username: "",
    bio: "",
    email: "",
  })
  const [passwordData, setPasswordData] = useState({
    currentPin: "",
    newPin: "",
    confirmPin: "",
  })
  const [lockTimeData, setLockTimeData] = useState({
    value: "1",
    unit: "minute",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isChangingLockTime, setIsChangingLockTime] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const supabase = createClientSupabaseClient()

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || "",
        bio: user.bio || "",
        email: user.email || "",
      })
      setAvatarUrl(user.avatar_url)

      // 获取用户锁定时间设置
      if (user.lock_time) {
        try {
          const lockTimeInSeconds = Number.parseInt(user.lock_time)
          if (lockTimeInSeconds % 60 === 0) {
            // 如果是分钟的整数倍
            setLockTimeData({
              value: (lockTimeInSeconds / 60).toString(),
              unit: "minute",
            })
          } else {
            // 否则使用秒
            setLockTimeData({
              value: lockTimeInSeconds.toString(),
              unit: "second",
            })
          }
        } catch (error) {
          // 如果解析失败，使用默认值
          setLockTimeData({
            value: "1",
            unit: "minute",
          })
        }
      }
    }
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setPasswordData((prev) => ({ ...prev, [name]: value }))
  }

  const handleLockTimeValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLockTimeData((prev) => ({ ...prev, value: e.target.value }))
  }

  const handleLockTimeUnitChange = (value: string) => {
    setLockTimeData((prev) => ({ ...prev, unit: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setIsSubmitting(true)

    try {
      await updateUserProfile({
        username: formData.username,
        bio: formData.bio,
        email: formData.email,
      })

      toast({
        title: "个人信息已更新",
        description: "您的个人信息已成功更新",
      })
    } catch (error) {
      console.error("Failed to update profile:", error)
      toast({
        title: "更新失败",
        description: "个人信息更新失败，请重试",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // 验证输入
    if (passwordData.newPin.length !== 6) {
      toast({
        title: "错误",
        description: "PIN码必须为6位数字",
        variant: "destructive",
      })
      return
    }

    if (passwordData.newPin !== passwordData.confirmPin) {
      toast({
        title: "错误",
        description: "两次输入的新PIN码不一致",
        variant: "destructive",
      })
      return
    }

    setIsChangingPassword(true)

    try {
      // 验证当前PIN码
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .eq("pin", passwordData.currentPin)
        .single()

      if (error || !data) {
        toast({
          title: "错误",
          description: "当前PIN码不正确",
          variant: "destructive",
        })
        setIsChangingPassword(false)
        return
      }

      // 更新PIN码
      const { error: updateError } = await supabase.from("users").update({ pin: passwordData.newPin }).eq("id", user.id)

      if (updateError) throw updateError

      // 清空表单
      setPasswordData({
        currentPin: "",
        newPin: "",
        confirmPin: "",
      })

      toast({
        title: "PIN码已更新",
        description: "您的PIN码已成功更新",
      })
    } catch (error) {
      console.error("Failed to update PIN:", error)
      toast({
        title: "更新失败",
        description: "PIN码更新失败，请重试",
        variant: "destructive",
      })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleChangeLockTime = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // 验证输入
    const lockTimeValue = Number.parseInt(lockTimeData.value)
    if (isNaN(lockTimeValue) || lockTimeValue < 0) {
      toast({
        title: "错误",
        description: "请输入有效的锁定时间",
        variant: "destructive",
      })
      return
    }

    setIsChangingLockTime(true)

    try {
      // 计算锁定时间（秒）
      const lockTimeInSeconds = lockTimeData.unit === "minute" ? lockTimeValue * 60 : lockTimeValue

      // 更新锁定时间
      const { error: updateError } = await supabase
        .from("users")
        .update({ lock_time: lockTimeInSeconds.toString() })
        .eq("id", user.id)

      if (updateError) throw updateError

      // 更新本地用户数据
      await updateUserProfile({
        lock_time: lockTimeInSeconds.toString(),
      })

      toast({
        title: "锁定时间已更新",
        description: lockTimeValue === 0 ? "已设置为永不锁定" : "您的页面锁定时间已成功更新",
      })
    } catch (error) {
      console.error("Failed to update lock time:", error)
      toast({
        title: "更新失败",
        description: "锁定时间更新失败，请重试",
        variant: "destructive",
      })
    } finally {
      setIsChangingLockTime(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      // 生成唯一文件名
      const fileExt = file.name.split(".").pop()
      const fileName = `${user.id}_${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      // 上传到Supabase存储
      const { data, error } = await supabase.storage.from("avatars").upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      })

      if (error) throw error

      // 获取公共URL
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath)

      // 更新用户头像
      await updateUserProfile({
        avatar_url: urlData.publicUrl,
      })

      setAvatarUrl(urlData.publicUrl)

      toast({
        title: "头像已更新",
        description: "您的头像已成功更新",
      })
    } catch (error) {
      console.error("Upload error:", error)
      toast({
        title: "上传失败",
        description: "头像上传失败，请重试",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const copyToClipboard = () => {
    if (!user) return

    // 在前端显示为4位ID
    const displayId = user.id.padStart(4, "0")
    navigator.clipboard.writeText(displayId)
    setCopied(true)

    setTimeout(() => {
      setCopied(false)
    }, 2000)

    toast({
      title: "已复制",
      description: "账户ID已复制到剪贴板",
    })
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  // 在前端显示为4位ID
  const displayId = user.id.padStart(4, "0")

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-8">
          <TabsTrigger value="profile">个人资料</TabsTrigger>
          <TabsTrigger value="account">账户设置</TabsTrigger>
          <TabsTrigger value="security">安全设置</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-32 w-32">
                  {avatarUrl ? (
                    <SupabaseImage
                      src={avatarUrl}
                      bucket="avatars"
                      alt={user.username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <AvatarFallback className="text-4xl">{user.username[0]}</AvatarFallback>
                  )}
                </Avatar>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="absolute bottom-0 right-0 h-10 w-10 rounded-full bg-background shadow-md"
                  onClick={() => document.getElementById("avatar-upload")?.click()}
                  disabled={isUploading}
                >
                  <Upload className="h-5 w-5" />
                  <span className="sr-only">上传头像</span>
                </Button>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={isUploading}
                />
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold">{user.username}</h3>
              </div>
              {isUploading && <p className="text-sm text-muted-foreground">上传中...</p>}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="username">用户名</Label>
                  <Input id="username" name="username" value={formData.username} onChange={handleChange} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input id="email" name="email" type="email" value={formData.email || ""} onChange={handleChange} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">个人简介</Label>
                <Textarea id="bio" name="bio" value={formData.bio || ""} onChange={handleChange} rows={4} />
              </div>

              <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span>保存中...</span>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    <span>保存更改</span>
                  </>
                )}
              </Button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="account">
          <div className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">账户信息</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="block mb-2">账户ID</Label>
                  <div className="inline-flex items-center bg-card border rounded-md">
                    <div className="flex gap-2 p-4">
                      {displayId.split("").map((digit, index) => (
                        <div
                          key={index}
                          className="w-10 h-10 flex items-center justify-center bg-muted rounded-md font-mono text-xl font-bold"
                        >
                          {digit}
                        </div>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" className="mx-2" onClick={copyToClipboard}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      <span className="ml-2">{copied ? "已复制" : "复制"}</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">这是您的唯一账户ID，可用于添加好友和登录</p>
                </div>

                <div className="space-y-2">
                  <Label>账户创建时间</Label>
                  <div className="p-3 bg-background border rounded-md">
                    {new Date(user.created_at).toLocaleDateString()} {new Date(user.created_at).toLocaleTimeString()}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>最后登录时间</Label>
                  <div className="p-3 bg-background border rounded-md">
                    {new Date(user.last_seen).toLocaleDateString()} {new Date(user.last_seen).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button variant="destructive" className="w-full md:w-auto" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>退出登录</span>
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">修改PIN码</h3>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPin">当前PIN码</Label>
                  <Input
                    id="currentPin"
                    name="currentPin"
                    type="password"
                    value={passwordData.currentPin}
                    onChange={handlePasswordChange}
                    placeholder="请输入当前PIN码"
                    maxLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPin">新PIN码</Label>
                  <Input
                    id="newPin"
                    name="newPin"
                    type="password"
                    value={passwordData.newPin}
                    onChange={handlePasswordChange}
                    placeholder="请输入新PIN码"
                    maxLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPin">确认新PIN码</Label>
                  <Input
                    id="confirmPin"
                    name="confirmPin"
                    type="password"
                    value={passwordData.confirmPin}
                    onChange={handlePasswordChange}
                    placeholder="请再次输入新PIN码"
                    maxLength={6}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full md:w-auto"
                  disabled={
                    isChangingPassword || !passwordData.currentPin || !passwordData.newPin || !passwordData.confirmPin
                  }
                >
                  {isChangingPassword ? (
                    <span>更新中...</span>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      <span>更新PIN码</span>
                    </>
                  )}
                </Button>
              </form>
            </div>

            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">页面锁定设置</h3>

              <form onSubmit={handleChangeLockTime} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="lockTime">页面锁定时间</Label>
                  <div className="flex gap-2">
                    <Input
                      id="lockTime"
                      type="number"
                      min="0"
                      value={lockTimeData.value}
                      onChange={handleLockTimeValueChange}
                      className="w-24"
                    />
                    <Select value={lockTimeData.unit} onValueChange={handleLockTimeUnitChange}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="选择单位" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="second">秒</SelectItem>
                        <SelectItem value="minute">分钟</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    设置页面在无操作多长时间后自动锁定，建议设置为1-5分钟。设置为0表示永不锁定。
                  </p>
                </div>

                <Button type="submit" className="w-full md:w-auto" disabled={isChangingLockTime}>
                  {isChangingLockTime ? (
                    <span>更新中...</span>
                  ) : (
                    <>
                      <Clock className="mr-2 h-4 w-4" />
                      <span>更新锁定时间</span>
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
