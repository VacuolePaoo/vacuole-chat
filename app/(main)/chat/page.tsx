"use client"
import { useSearchParams } from "next/navigation"
import { ChatRoom } from "@/components/chat-room"
import { PrivateChat } from "@/components/private-chat"

export default function ChatPage() {
  const searchParams = useSearchParams()
  const type = searchParams.get("type") || "public"
  const friendId = searchParams.get("friend")

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1">{type === "public" ? <ChatRoom /> : <PrivateChat initialFriendId={friendId} />}</div>
    </div>
  )
}
