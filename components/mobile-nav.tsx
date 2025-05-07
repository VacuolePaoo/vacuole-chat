"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageSquare, Users, UserPlus, Bell, User, Menu, LogOut, Globe, Briefcase, Info } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useUser } from "@/contexts/user-context"
import { createClientSupabaseClient } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface MobileNavProps extends React.HTMLAttributes<HTMLDivElement> {}

export function MobileNav({ className }: MobileNavProps) {
  const pathname = usePathname()
  const [activeItem, setActiveItem] = useState(pathname)
  const [open, setOpen] = useState(false)
  const { user, logout } = useUser()
  const supabase = createClientSupabaseClient()
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false)

  // 添加未读消息和好友申请计数
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
      .channel("unread_messages_count_mobile")
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
      .channel("friend_requests_count_mobile")
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

  // 获取当前活动项的名称
  const getActiveItemName = () => {
    if (pathname === "/chat") {
      const type = new URLSearchParams(window.location.search).get("type") || "public"
      return type === "public" ? "公共聊天室" : "私聊"
    }
    const activeNav = navItems.find((item) => item.href.split("?")[0] === pathname)
    return activeNav?.name || "聊天室"
  }

  return (
    <div className={cn("flex items-center justify-between border-b p-4", className)}>
      <div className="flex items-center gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">打开菜单</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 p-4 border-b">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder.svg?height=32&width=32" alt="Logo" />
                  <AvatarFallback>CH</AvatarFallback>
                </Avatar>
                <h1 className="text-xl font-bold">聊天室</h1>
              </div>

              <nav className="flex-1 p-4 space-y-2">
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
                        className={cn(
                          "w-full justify-start gap-2",
                          isActive ? "bg-primary text-primary-foreground" : "",
                        )}
                        onClick={() => {
                          setActiveItem(item.href)
                          setOpen(false)
                        }}
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

              <div className="p-4 border-t">
                <div className="flex items-center gap-3 mb-4">
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
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 justify-start gap-2" onClick={logout}>
                    <LogOut className="h-5 w-5" />
                    退出登录
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => {
                      setOpen(false)
                      setIsUpdateDialogOpen(true)
                    }}
                  >
                    <Info className="h-5 w-5" />
                    <span className="sr-only">更新信息</span>
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <h1 className="text-lg font-bold">{getActiveItemName()}</h1>
      </div>

      {/* 更新信息对话框 */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>最新更新内容</DialogTitle>
            <DialogDescription>了解聊天室的最新功能和改进</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">2023年5月更新</h3>
              <ul className="space-y-2 list-disc list-inside text-sm">
                <li>
                  <span className="font-medium">私聊端对端加密</span>
                  <p className="text-muted-foreground ml-6">现在您可以在私聊中启用端对端加密，确保消息安全</p>
                </li>
                <li>
                  <span className="font-medium">移动端优化</span>
                  <p className="text-muted-foreground ml-6">改进了移动设备上的聊天体验，添加了返回按钮</p>
                </li>
                <li>
                  <span className="font-medium">消息通知</span>
                  <p className="text-muted-foreground ml-6">在其他页面收到私信或好友申请时会显示通知</p>
                </li>
                <li>
                  <span className="font-medium">界面优化</span>
                  <p className="text-muted-foreground ml-6">优化了账户ID显示和百宝箱链接卡片的设计</p>
                </li>
                <li>
                  <span className="font-medium">表情包加载优化</span>
                  <p className="text-muted-foreground ml-6">打开表情选择器时自动加载第一个表情包</p>
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">即将推出</h3>
              <ul className="space-y-2 list-disc list-inside text-sm">
                <li>群聊功能</li>
                <li>消息撤回</li>
                <li>更多表情包</li>
                <li>语音消息</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
