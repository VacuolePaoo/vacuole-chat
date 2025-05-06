"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageSquare, Users, UserPlus, Bell, User, LogOut, Globe, Briefcase } from "lucide-react"
import { useUser } from "@/contexts/user-context"
import { createClientSupabaseClient } from "@/lib/supabase"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [activeItem, setActiveItem] = useState(pathname)
  const { user, logout } = useUser()
  const supabase = createClientSupabaseClient()

  const [unreadCounts, setUnreadCounts] = useState({
    messages: 0,
    friendRequests: 0,
  })

  useEffect(() => {
    setActiveItem(pathname)
  }, [pathname])

  // 获取未读消息和好友申请数量
  useEffect(() => {
    if (!user) return

    const fetchUnreadCounts = async () => {
      try {
        // 获取未读消息数量
        const { data: chatsData, error: chatsError } = await supabase
          .from("private_chats")
          .select("id")
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

        if (chatsError) {
          console.error("Error fetching chats:", chatsError)
          return
        }

        // 如果没有聊天，则未读消息为0
        if (!chatsData || chatsData.length === 0) {
          setUnreadCounts((prev) => ({ ...prev, messages: 0 }))
        } else {
          const chatIds = chatsData.map((chat) => chat.id)

          // 获取未读消息数量
          const { count: unreadMessages, error: messagesError } = await supabase
            .from("private_messages")
            .select("id", { count: "exact" })
            .eq("is_read", false)
            .neq("sender_id", user.id)
            .in("chat_id", chatIds)

          if (!messagesError) {
            setUnreadCounts((prev) => ({ ...prev, messages: unreadMessages || 0 }))
          }
        }

        // 获取未处理的好友申请数量
        const { count: pendingRequests, error: requestsError } = await supabase
          .from("friend_requests")
          .select("id", { count: "exact" })
          .eq("receiver_id", user.id)
          .eq("status", "pending")

        if (!requestsError) {
          setUnreadCounts((prev) => ({ ...prev, friendRequests: pendingRequests || 0 }))
        }
      } catch (error) {
        console.error("Error fetching unread counts:", error)
      }
    }

    // 初始加载
    fetchUnreadCounts()

    // 监听未读消息更新事件
    const handleUnreadMessagesUpdated = () => {
      fetchUnreadCounts()
    }

    window.addEventListener("unread-messages-updated", handleUnreadMessagesUpdated)

    // 订阅私信变化
    const messagesChannel = supabase
      .channel("unread_messages_count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "private_messages",
          filter: `is_read=eq.false`,
        },
        () => {
          fetchUnreadCounts()
        },
      )
      .subscribe()

    // 订阅好友申请变化
    const requestsChannel = supabase
      .channel("friend_requests_count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadCounts()
        },
      )
      .subscribe()

    return () => {
      window.removeEventListener("unread-messages-updated", handleUnreadMessagesUpdated)
      supabase.removeChannel(messagesChannel)
      supabase.removeChannel(requestsChannel)
    }
  }, [user, supabase])

  const navItems = [
    {
      name: "公共聊天室",
      href: "/chat?type=public",
      icon: Globe,
    },
    {
      name: "私聊",
      href: "/chat?type=private",
      icon: MessageSquare,
      badge: unreadCounts.messages > 0 ? unreadCounts.messages : undefined,
    },
    {
      name: "好友",
      href: "/friends",
      icon: Users,
    },
    {
      name: "添加好友",
      href: "/add-friend",
      icon: UserPlus,
    },
    {
      name: "好友申请",
      href: "/friend-requests",
      icon: Bell,
      badge: unreadCounts.friendRequests > 0 ? unreadCounts.friendRequests : undefined,
    },
    {
      name: "百宝箱",
      href: "/toolbox",
      icon: Briefcase,
    },
    {
      name: "个人信息",
      href: "/profile",
      icon: User,
    },
  ]

  return (
    <div className={cn("flex flex-col w-64 border-r bg-card p-4", className)}>
      <div className="flex items-center gap-2 px-2 mb-8">
        <Avatar className="h-8 w-8">
          <AvatarImage src="/placeholder.svg?height=32&width=32" alt="Logo" />
          <AvatarFallback>CH</AvatarFallback>
        </Avatar>
        <h1 className="text-xl font-bold">聊天室</h1>
      </div>

      <nav className="space-y-2 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.href.startsWith("/chat")
            ? pathname === "/chat" &&
              item.href.includes(new URLSearchParams(window.location.search).get("type") || "public")
            : activeItem === item.href

          return (
            <Link key={item.href} href={item.href} passHref>
              <Button
                variant={isActive ? "default" : "ghost"}
                className={cn("w-full justify-start gap-2", isActive ? "bg-primary text-primary-foreground" : "")}
                onClick={() => setActiveItem(item.href)}
              >
                <Icon className="h-5 w-5" />
                <span className="flex-1 text-left">{item.name}</span>
                {item.badge !== undefined && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Button>
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-4 border-t">
        <div className="flex items-center gap-3 px-2 mb-4">
          <Avatar>
            <AvatarImage
              src={user?.avatar_url || "/placeholder.svg?height=40&width=40"}
              alt={user?.username || "用户"}
            />
            <AvatarFallback>{user?.username?.[0] || "用"}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{user?.username || "用户"}</span>
            <span className="text-xs text-muted-foreground">ID: {user?.id || ""}</span>
          </div>
        </div>
        <Button variant="outline" className="w-full justify-start gap-2" onClick={logout}>
          <LogOut className="h-5 w-5" />
          退出登录
        </Button>
      </div>
    </div>
  )
}
