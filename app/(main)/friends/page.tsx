"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, MessageSquare, MoreHorizontal } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { createClientSupabaseClient } from "@/lib/supabase"
import { useUser } from "@/contexts/user-context"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

type Friend = {
  id: string
  username: string
  avatar_url: string | null
  last_seen: string
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useUser()
  const supabase = createClientSupabaseClient()
  const router = useRouter()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [friendToDelete, setFriendToDelete] = useState<Friend | null>(null)
  const [pin, setPin] = useState("")
  const [isConfirming, setIsConfirming] = useState(false)

  useEffect(() => {
    if (!user) return

    const fetchFriends = async () => {
      try {
        // 获取好友关系
        const { data: friendsData, error: friendsError } = await supabase
          .from("friends")
          .select("friend_id")
          .eq("user_id", user.id)

        if (friendsError) throw friendsError

        if (!friendsData.length) {
          setFriends([])
          setIsLoading(false)
          return
        }

        const friendIds = friendsData.map((f) => f.friend_id)

        // 获取好友信息
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, username, avatar_url, last_seen")
          .in("id", friendIds)

        if (usersError) throw usersError

        setFriends(usersData)
      } catch (error) {
        console.error("Error fetching friends:", error)
        toast({
          title: "加载失败",
          description: "无法加载好友列表",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchFriends()

    // 设置好友状态的实时订阅
    const userChannel = supabase
      .channel("friends_presence")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "users",
          filter: user.id ? `id=in.(${friends.map((f) => f.id).join(",")})` : undefined,
        },
        (payload) => {
          setFriends((current) =>
            current.map((friend) =>
              friend.id === payload.new.id ? { ...friend, last_seen: payload.new.last_seen } : friend,
            ),
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(userChannel)
    }
  }, [user, supabase, friends])

  const handleRemoveFriend = (friend: Friend) => {
    setFriendToDelete(friend)
    setIsDeleteDialogOpen(true)
    setPin("")
  }

  const confirmRemoveFriend = async () => {
    if (!user || !friendToDelete) return

    setIsConfirming(true)

    try {
      // 验证PIN码
      const { data, error } = await supabase.from("users").select("id").eq("id", user.id).eq("pin", pin).single()

      if (error || !data) {
        toast({
          title: "PIN码错误",
          description: "请输入正确的PIN码",
          variant: "destructive",
        })
        setIsConfirming(false)
        return
      }

      // 删除好友关系（双向）
      const { error: error1 } = await supabase
        .from("friends")
        .delete()
        .eq("user_id", user.id)
        .eq("friend_id", friendToDelete.id)
      const { error: error2 } = await supabase
        .from("friends")
        .delete()
        .eq("user_id", friendToDelete.id)
        .eq("friend_id", user.id)

      if (error1 || error2) throw error1 || error2

      // 更新本地状态
      setFriends(friends.filter((friend) => friend.id !== friendToDelete.id))

      toast({
        title: "已删除好友",
        description: "好友关系已解除",
      })

      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error("Error removing friend:", error)
      toast({
        title: "操作失败",
        description: "删除好友失败，请重试",
        variant: "destructive",
      })
    } finally {
      setIsConfirming(false)
    }
  }

  const isOnline = (lastSeen: string) => {
    const now = new Date()
    const lastSeenDate = new Date(lastSeen)
    const diffMinutes = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60))
    return diffMinutes < 5 // 5分钟内在线
  }

  const filteredFriends = friends.filter((friend) => friend.username.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="p-4 space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索好友..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : filteredFriends.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchQuery ? "没有找到匹配的好友" : "暂无好友，去添加好友吧！"}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFriends.map((friend) => (
            <Card key={friend.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar>
                        <AvatarImage
                          src={friend.avatar_url || "/placeholder.svg?height=40&width=40"}
                          alt={friend.username}
                        />
                        <AvatarFallback>{friend.username[0]}</AvatarFallback>
                      </Avatar>
                      <span
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                          isOnline(friend.last_seen) ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                    </div>
                    <div>
                      <div className="font-medium">{friend.username}</div>
                      <div className="text-xs text-muted-foreground">ID: {friend.id}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => router.push(`/chat?friend=${friend.id}`)}>
                      <MessageSquare className="h-5 w-5" />
                      <span className="sr-only">发送消息</span>
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-5 w-5" />
                          <span className="sr-only">更多选项</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleRemoveFriend(friend)}>删除好友</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* 删除好友确认对话框 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除好友</DialogTitle>
          </DialogHeader>
          <p>您确定要删除好友 "{friendToDelete?.username}" 吗？此操作无法撤销。</p>
          <div className="space-y-2 mt-4">
            <Label htmlFor="pin">请输入您的PIN码确认</Label>
            <Input
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="请输入6位PIN码"
              maxLength={6}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmRemoveFriend}
              disabled={isConfirming || pin.length !== 6}
            >
              {isConfirming ? "处理中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
