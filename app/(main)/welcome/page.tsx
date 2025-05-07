"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUser } from "@/contexts/user-context"
import { SupabaseImage } from "@/components/supabase-image"
import { MessageSquare, Users, UserPlus, Bell, User, Globe, Briefcase, ImageIcon, Save } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { createClientSupabaseClient } from "@/lib/supabase"

export default function WelcomePage() {
  const { user, updateUserProfile } = useUser()
  const router = useRouter()
  const [greeting, setGreeting] = useState("")
  const [isEditingBg, setIsEditingBg] = useState(false)
  const [bgUrl, setBgUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClientSupabaseClient()

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) {
      setGreeting("早上好")
    } else if (hour < 18) {
      setGreeting("下午好")
    } else {
      setGreeting("晚上好")
    }

    // 如果用户有背景图，设置背景图URL
    if (user?.bg) {
      setBgUrl(user.bg)
    }
  }, [user])

  const handleSaveBg = async () => {
    if (!user) return

    setIsSubmitting(true)

    try {
      await updateUserProfile({
        bg: bgUrl,
      })

      toast({
        title: "背景已更新",
        description: "您的欢迎页面背景已成功更新",
      })

      setIsEditingBg(false)
    } catch (error) {
      console.error("Failed to update background:", error)
      toast({
        title: "更新失败",
        description: "背景更新失败，请重试",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const features = [
    {
      icon: Globe,
      title: "公共聊天室",
      description: "与所有用户进行实时交流",
      action: () => router.push("/chat?type=public"),
    },
    {
      icon: MessageSquare,
      title: "私聊",
      description: "与好友进行一对一的私密交流",
      action: () => router.push("/chat?type=private"),
    },
    {
      icon: Users,
      title: "好友列表",
      description: "查看和管理您的好友",
      action: () => router.push("/friends"),
    },
    {
      icon: UserPlus,
      title: "添加好友",
      description: "发送好友请求添加新朋友",
      action: () => router.push("/add-friend"),
    },
    {
      icon: Bell,
      title: "好友申请",
      description: "查看和处理收到的好友请求",
      action: () => router.push("/friend-requests"),
    },
    {
      icon: Briefcase,
      title: "百宝箱",
      description: "收藏和分享有用的网址",
      action: () => router.push("/toolbox"),
    },
    {
      icon: User,
      title: "个人信息",
      description: "查看和编辑您的个人资料",
      action: () => router.push("/profile"),
    },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div
        className="relative mb-10 rounded-xl overflow-hidden bg-gradient-to-r from-indigo-500 to-purple-600"
        style={{
          backgroundImage: user?.bg ? `url(${user.bg})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>

        <div className="relative z-10 p-10 md:p-16 flex flex-col md:flex-row items-center">
          <div className="mb-6 md:mb-0 md:mr-8">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden mx-auto border-4 border-white/50 shadow-xl">
              <Avatar className="w-full h-full">
                {user?.avatar_url ? (
                  <SupabaseImage
                    src={user.avatar_url}
                    bucket="avatars"
                    alt={user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <AvatarFallback className="w-full h-full text-4xl font-bold">
                    {user?.username?.[0] || "?"}
                  </AvatarFallback>
                )}
              </Avatar>
            </div>
          </div>

          <div className="text-center md:text-left text-white">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              {greeting}，{user?.username || "用户"}
            </h1>
            <p className="text-lg text-white/80 mb-4">ID: {user?.id || ""}</p>
            <p className="mb-6 text-white/90 max-w-md">{user?.bio || "这个用户很懒，还没有设置个人简介..."}</p>
            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
              <Button
                onClick={() => router.push("/profile")}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-md"
              >
                编辑个人资料
              </Button>
              <Button
                variant="outline"
                className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-md"
                onClick={() => setIsEditingBg(true)}
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                更换背景
              </Button>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-6">功能导航</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="bg-card border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={feature.action}
          >
            <div className="flex items-center mb-4">
              <div className="bg-primary/10 p-3 rounded-full mr-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-medium">{feature.title}</h3>
            </div>
            <p className="text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* 背景设置对话框 */}
      <Dialog open={isEditingBg} onOpenChange={setIsEditingBg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>更换欢迎页面背景</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bg-url">背景图片URL</Label>
              <Input
                id="bg-url"
                placeholder="输入图片URL，例如: https://example.com/image.jpg"
                value={bgUrl}
                onChange={(e) => setBgUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">请输入有效的图片URL，建议使用高清图片以获得最佳效果</p>
            </div>

            {bgUrl && (
              <div className="space-y-2">
                <Label>预览</Label>
                <div className="relative h-40 rounded-md overflow-hidden">
                  <img
                    src={bgUrl || "/placeholder.svg"}
                    alt="背景预览"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder.svg?height=160&width=320"
                      e.currentTarget.classList.add("border")
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingBg(false)}>
              取消
            </Button>
            <Button onClick={handleSaveBg} disabled={isSubmitting}>
              {isSubmitting ? (
                <span>保存中...</span>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  保存背景
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
