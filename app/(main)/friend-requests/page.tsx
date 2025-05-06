"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { Check, X } from "lucide-react"
import { createClientSupabaseClient } from "@/lib/supabase"
import { useUser } from "@/contexts/user-context"

type FriendRequest = {
  id: string
  sender_id: string
  created_at: string
  sender: {
    username: string
    avatar_url: string | null
  }
}

export default function FriendRequestsPage() {
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useUser()
  const supabase = createClientSupabaseClient()

  useEffect(() => {
    if (!user) return

    const fetchRequests = async () => {
      try {
        const { data, error } = await supabase
          .from("friend_requests")
          .select(`
            id,
            sender_id,
            created_at,
            users!friend_requests_sender_id_fkey (
              username,
              avatar_url
            )
          `)
          .eq("receiver_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })

        if (error) throw error

        // 转换数据格式
        const formattedRequests = data.map((request) => ({
          id: request.id,
          sender_id: request.sender_id,
          created_at: request.created_at,
          sender: {
            username: request.users.username,
            avatar_url: request.users.avatar_url,
          },
        }))

        setRequests(formattedRequests)
      } catch (error) {
        console.error("Error fetching friend requests:", error)
        toast({
          title: "加载失败",
          description: "无法加载好友请求",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchRequests()

    // 设置实时订阅
    const channel = supabase
      .channel("friend_requests")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "friend_requests",
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          // 获取发送者信息
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("username, avatar_url")
            .eq("id", payload.new.sender_id)
            .single()

          if (userError) return

          const newRequest = {
            id: payload.new.id,
            sender_id: payload.new.sender_id,
            created_at: payload.new.created_at,
            sender: {
              username: userData.username,
              avatar_url: userData.avatar_url,
            },
          }

          setRequests((current) => [newRequest, ...current])
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, supabase])

  const handleAccept = async (id: string, senderId: string) => {
    if (!user) return

    try {
      // 更新请求状态
      const { error: updateError } = await supabase.from("friend_requests").update({ status: "accepted" }).eq("id", id)

      if (updateError) throw updateError

      // 创建双向好友关系
      const { error: friendError1 } = await supabase.from("friends").insert({
        user_id: user.id,
        friend_id: senderId,
      })

      const { error: friendError2 } = await supabase.from("friends").insert({
        user_id: senderId,
        friend_id: user.id,
      })

      if (friendError1 || friendError2) throw friendError1 || friendError2

      // 更新本地状态
      setRequests(requests.filter((req) => req.id !== id))

      const request = requests.find((req) => req.id === id)
      if (request) {
        toast({
          title: "已接受好友请求",
          description: `${request.sender.username} 已添加为好友`,
        })
      }
    } catch (error) {
      console.error("Error accepting friend request:", error)
      toast({
        title: "操作失败",
        description: "接受好友请求失败，请重试",
        variant: "destructive",
      })
    }
  }

  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase.from("friend_requests").update({ status: "rejected" }).eq("id", id)

      if (error) throw error

      // 更新本地状态
      setRequests(requests.filter((req) => req.id !== id))

      toast({
        title: "已拒绝好友请求",
        variant: "destructive",
      })
    } catch (error) {
      console.error("Error rejecting friend request:", error)
      toast({
        title: "操作失败",
        description: "拒绝好友请求失败，请重试",
        variant: "destructive",
      })
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) {
      return `${diffMins} 分钟前`
    } else if (diffHours < 24) {
      return `${diffHours} 小时前`
    } else {
      return `${diffDays} 天前`
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">好友申请</h2>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">暂无好友申请</div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage
                        src={request.sender.avatar_url || "/placeholder.svg?height=40&width=40"}
                        alt={request.sender.username}
                      />
                      <AvatarFallback>{request.sender.username[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{request.sender.username}</div>
                      <div className="text-xs text-muted-foreground">
                        ID: {request.sender_id} · {formatTime(request.created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleReject(request.id)}>
                      <X className="h-5 w-5" />
                      <span className="sr-only">拒绝</span>
                    </Button>
                    <Button variant="default" size="icon" onClick={() => handleAccept(request.id, request.sender_id)}>
                      <Check className="h-5 w-5" />
                      <span className="sr-only">接受</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
