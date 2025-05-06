"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { UserPlus, Search } from "lucide-react"
import { createClientSupabaseClient } from "@/lib/supabase"
import { useUser } from "@/contexts/user-context"

export default function AddFriendPage() {
  const [friendId, setFriendId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { user } = useUser()
  const supabase = createClientSupabaseClient()

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!friendId.trim() || !user) {
      toast({
        title: "错误",
        description: "请输入好友ID",
        variant: "destructive",
      })
      return
    }

    if (friendId === user.id) {
      toast({
        title: "错误",
        description: "不能添加自己为好友",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // 检查用户是否存在
      const { data: userData, error: userError } = await supabase.from("users").select("id").eq("id", friendId).single()

      if (userError || !userData) {
        toast({
          title: "错误",
          description: "用户不存在",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      // 检查是否已经是好友
      const { data: existingFriend, error: friendError } = await supabase
        .from("friends")
        .select("id")
        .eq("user_id", user.id)
        .eq("friend_id", friendId)

      if (existingFriend && existingFriend.length > 0) {
        toast({
          title: "错误",
          description: "该用户已经是您的好友",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      // 检查是否已经发送过请求
      const { data: existingRequest, error: requestError } = await supabase
        .from("friend_requests")
        .select("id, status")
        .eq("sender_id", user.id)
        .eq("receiver_id", friendId)

      if (existingRequest && existingRequest.length > 0) {
        // 如果请求存在且状态为pending
        if (existingRequest[0].status === "pending") {
          toast({
            title: "错误",
            description: "您已经向该用户发送过好友请求",
            variant: "destructive",
          })
          setIsSubmitting(false)
          return
        }
        // 如果请求存在但状态不是pending，更新状态为pending
        else {
          const { error: updateError } = await supabase
            .from("friend_requests")
            .update({ status: "pending" })
            .eq("id", existingRequest[0].id)

          if (updateError) throw updateError

          toast({
            title: "好友请求已发送",
            description: `已向ID为 ${friendId} 的用户发送好友请求`,
          })
          setFriendId("")
          setIsSubmitting(false)
          return
        }
      }

      // 检查对方是否已经向你发送过请求
      const { data: incomingRequest, error: incomingError } = await supabase
        .from("friend_requests")
        .select("id, status")
        .eq("sender_id", friendId)
        .eq("receiver_id", user.id)

      if (incomingRequest && incomingRequest.length > 0 && incomingRequest[0].status === "pending") {
        toast({
          title: "提示",
          description: "对方已经向您发送了好友请求，请在好友申请页面处理",
        })
        setIsSubmitting(false)
        return
      }

      // 发送好友请求
      const { error: insertError } = await supabase.from("friend_requests").insert({
        sender_id: user.id,
        receiver_id: friendId,
        status: "pending",
      })

      if (insertError) {
        // 如果是唯一约束错误，可能是并发问题，尝试更新
        if (insertError.code === "23505") {
          const { error: updateError } = await supabase
            .from("friend_requests")
            .update({ status: "pending" })
            .eq("sender_id", user.id)
            .eq("receiver_id", friendId)

          if (updateError) throw updateError
        } else {
          throw insertError
        }
      }

      toast({
        title: "好友请求已发送",
        description: `已向ID为 ${friendId} 的用户发送好友请求`,
      })

      setFriendId("")
    } catch (error) {
      console.error("Error sending friend request:", error)
      toast({
        title: "操作失败",
        description: "发送好友请求失败，请重试",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">添加好友</h1>
        <p className="text-muted-foreground">输入好友的ID来发送好友请求</p>
      </div>

      <div className="bg-card border rounded-lg p-6 shadow-sm">
        <form onSubmit={handleAddFriend} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="friendId" className="text-base">
              好友ID
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="friendId"
                placeholder="输入4位数字ID"
                value={friendId}
                onChange={(e) => setFriendId(e.target.value)}
                maxLength={4}
                className="pl-9 text-lg h-12"
              />
            </div>
            <p className="text-sm text-muted-foreground">每个用户都有一个唯一的ID，您可以通过ID添加好友</p>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || !friendId.trim()}>
            {isSubmitting ? (
              <span>处理中...</span>
            ) : (
              <>
                <UserPlus className="mr-2 h-5 w-5" />
                <span>发送好友请求</span>
              </>
            )}
          </Button>
        </form>
      </div>

      <div className="mt-8 bg-muted/50 rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">如何找到好友的ID？</h2>
        <ul className="space-y-2 list-disc list-inside text-muted-foreground">
          <li>好友可以在个人资料页面查看自己的ID</li>
          <li>ID是一个4位数字，例如：0123</li>
          <li>添加好友后，对方需要接受您的请求才能成为好友</li>
        </ul>
      </div>
    </div>
  )
}
