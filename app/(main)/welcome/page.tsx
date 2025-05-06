"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useUser } from "@/contexts/user-context"
import { SupabaseImage } from "@/components/supabase-image"
import { MessageSquare, Users, UserPlus, Bell, User, Globe } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function WelcomePage() {
  const { user } = useUser()
  const router = useRouter()
  const [greeting, setGreeting] = useState("")

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) {
      setGreeting("早上好")
    } else if (hour < 18) {
      setGreeting("下午好")
    } else {
      setGreeting("晚上好")
    }
  }, [])

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
      icon: User,
      title: "个人信息",
      description: "查看和编辑您的个人资料",
      action: () => router.push("/profile"),
    },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold mb-2">
          {greeting}，{user?.username || "用户"}
        </h1>
        <p className="text-muted-foreground">欢迎使用在线聊天室，开始您的聊天之旅吧！</p>
      </div>

      <div className="flex flex-col md:flex-row items-center mb-10 bg-muted/30 rounded-lg p-6">
        <div className="mb-6 md:mb-0 md:mr-8">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden mx-auto">
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
        <div className="text-center md:text-left">
          <h2 className="text-2xl font-bold mb-2">{user?.username || "用户"}</h2>
          <p className="text-muted-foreground mb-4">ID: {user?.id || ""}</p>
          <p className="mb-4">{user?.bio || "这个用户很懒，还没有设置个人简介..."}</p>
          <Button onClick={() => router.push("/profile")}>编辑个人资料</Button>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-6">功能导航</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="bg-card border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={feature.action}
          >
            <div className="flex items-center mb-4">
              <div className="bg-primary/10 p-3 rounded-full mr-4">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-medium">{feature.title}</h3>
            </div>
            <p className="text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
