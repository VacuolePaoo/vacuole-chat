"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Search, ExternalLink, Smile } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { createClientSupabaseClient } from "@/lib/supabase"
import { useUser } from "@/contexts/user-context"
import { ImageUpload } from "@/components/image-upload"
import { toast } from "@/hooks/use-toast"
import { SupabaseImage } from "@/components/supabase-image"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Friend = {
  id: string
  username: string
  avatar_url: string | null
  last_seen: string
  last_message?: {
    content: string
    created_at: string
    sender_id: string
    image_url: string | null
  }
  unread_count: number
  chat_id?: string
}

type Message = {
  id: string
  sender_id: string
  content: string
  image_url: string | null
  created_at: string
}

type EmojiPack = {
  id: string
  name: string
  url: string
  emojis?: {
    text: string
    icon: string
  }[]
}

interface PrivateChatProps {
  initialFriendId?: string | null
}

export function PrivateChat({ initialFriendId }: PrivateChatProps) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [emojiPacks, setEmojiPacks] = useState<EmojiPack[]>([])
  const [isLoadingEmojis, setIsLoadingEmojis] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { user } = useUser()
  const supabase = createClientSupabaseClient()

  // 加载表情包
  useEffect(() => {
    const fetchEmojiPacks = async () => {
      try {
        const { data, error } = await supabase.from("emoji_packs").select("*")
        if (error) throw error

        setEmojiPacks(data)
      } catch (error) {
        console.error("Error fetching emoji packs:", error)
      }
    }

    fetchEmojiPacks()
  }, [supabase])

  // 加载好友列表
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
          return
        }

        const friendIds = friendsData.map((f) => f.friend_id)

        // 获取好友信息
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, username, avatar_url, last_seen")
          .in("id", friendIds)

        if (usersError) throw usersError

        // 获取每个好友的最后一条消息
        const friendsWithLastMessage = await Promise.all(
          usersData.map(async (friendUser) => {
            // 获取或创建聊天ID
            const chatId = await getOrCreateChatId(user.id, friendUser.id)

            // 获取最后一条消息
            const { data: lastMessageData, error: lastMessageError } = await supabase
              .from("private_messages")
              .select("content, created_at, sender_id, image_url")
              .eq("chat_id", chatId)
              .order("created_at", { ascending: false })
              .limit(1)
              .single()

            // 获取未读消息数
            const { count, error: countError } = await supabase
              .from("private_messages")
              .select("id", { count: "exact" })
              .eq("chat_id", chatId)
              .eq("sender_id", friendUser.id)
              .eq("is_read", false)

            return {
              ...friendUser,
              last_message: lastMessageError ? undefined : lastMessageData,
              unread_count: countError ? 0 : count || 0,
              chat_id: chatId,
            }
          }),
        )

        setFriends(friendsWithLastMessage)

        // 如果有初始好友ID，选择该好友
        if (initialFriendId) {
          const initialFriend = friendsWithLastMessage.find((f) => f.id === initialFriendId)
          if (initialFriend) {
            setSelectedFriend(initialFriend)
          }
        }
      } catch (error) {
        console.error("Error fetching friends:", error)
      }
    }

    fetchFriends()

    // 设置好友状态的实时订阅
    const userChannel = supabase
      .channel("users_presence")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "users",
          filter: `id=in.(${friends.map((f) => f.id).join(",")})`,
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
  }, [user, supabase, initialFriendId])

  // 获取或创建聊天ID
  const getOrCreateChatId = async (userId: string, friendId: string) => {
    try {
      // 先检查是否已存在聊天
      const { data: existingChat, error: existingError } = await supabase
        .from("private_chats")
        .select("id")
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .or(`user1_id.eq.${friendId},user2_id.eq.${friendId}`)
        .single()

      if (existingChat) return existingChat.id

      // 创建新的聊天
      const { data: newChat, error: createError } = await supabase
        .from("private_chats")
        .insert({
          user1_id: userId,
          user2_id: friendId,
        })
        .select("id")
        .single()

      if (createError) throw createError

      return newChat.id
    } catch (error) {
      console.error("Error getting or creating chat:", error)
      return null
    }
  }

  // 加载聊天消息并设置实时订阅
  useEffect(() => {
    if (!selectedFriend?.chat_id) {
      setMessages([])
      return
    }

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("private_messages")
          .select("id, sender_id, content, image_url, created_at")
          .eq("chat_id", selectedFriend.chat_id)
          .order("created_at", { ascending: true })

        if (error) throw error

        setMessages(data)

        // 标记消息为已读
        if (user) {
          await supabase
            .from("private_messages")
            .update({ is_read: true })
            .eq("chat_id", selectedFriend.chat_id)
            .eq("sender_id", selectedFriend.id)
            .eq("is_read", false)

          // 更新未读消息计数 - 同时更新本地状态和侧边栏状态
          setFriends((current) =>
            current.map((friend) => (friend.id === selectedFriend.id ? { ...friend, unread_count: 0 } : friend)),
          )

          // 触发全局未读消息计数更新的事件
          window.dispatchEvent(new CustomEvent("unread-messages-updated"))
        }

        // 滚动到底部
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView()
        }, 100)
      } catch (error) {
        console.error("Error fetching messages:", error)
      }
    }

    fetchMessages()

    // 设置实时订阅
    const messagesChannel = supabase
      .channel(`private_chat_${selectedFriend.chat_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_messages",
          filter: `chat_id=eq.${selectedFriend.chat_id}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message

          setMessages((current) => [...current, newMessage])

          // 如果是对方发送的消息，标记为已读
          if (newMessage.sender_id === selectedFriend.id && user) {
            await supabase.from("private_messages").update({ is_read: true }).eq("id", newMessage.id)

            // 触发全局未读消息计数更新的事件
            window.dispatchEvent(new CustomEvent("unread-messages-updated"))
          }

          // 滚动到底部
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
          }, 100)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messagesChannel)
    }
  }, [selectedFriend, supabase, user])

  // 设置未读消息的实时订阅
  useEffect(() => {
    if (!user) return

    const unreadChannel = supabase
      .channel("unread_messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_messages",
          filter: `is_read=eq.false`,
        },
        async (payload) => {
          const newMessage = payload.new as any

          // 如果消息不是发给当前用户的，忽略
          if (newMessage.sender_id === user.id) return

          // 获取聊天信息
          const { data: chatData, error: chatError } = await supabase
            .from("private_chats")
            .select("user1_id, user2_id")
            .eq("id", newMessage.chat_id)
            .single()

          if (chatError) return

          // 确定是否是发给当前用户的消息
          const isForCurrentUser =
            (chatData.user1_id === user.id && chatData.user2_id === newMessage.sender_id) ||
            (chatData.user2_id === user.id && chatData.user1_id === newMessage.sender_id)

          if (!isForCurrentUser) return

          // 如果当前没有选中该好友，增加未读计数
          if (!selectedFriend || selectedFriend.id !== newMessage.sender_id) {
            setFriends((current) =>
              current.map((friend) =>
                friend.id === newMessage.sender_id
                  ? {
                      ...friend,
                      unread_count: friend.unread_count + 1,
                      last_message: {
                        content: newMessage.content,
                        created_at: newMessage.created_at,
                        sender_id: newMessage.sender_id,
                        image_url: newMessage.image_url,
                      },
                    }
                  : friend,
              ),
            )

            // 触发全局未读消息计数更新的事件
            window.dispatchEvent(new CustomEvent("unread-messages-updated"))
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(unreadChannel)
    }
  }, [user, selectedFriend, supabase])

  const handleSelectFriend = (friend: Friend) => {
    setSelectedFriend(friend)
  }

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !imageUrl) || !user || !selectedFriend?.chat_id) return

    setIsLoading(true)

    try {
      const { error } = await supabase.from("private_messages").insert({
        chat_id: selectedFriend.chat_id,
        sender_id: user.id,
        content: newMessage.trim() || " ",
        image_url: imageUrl,
        is_read: false,
      })

      if (error) throw error

      setNewMessage("")
      setImageUrl(null)

      // 保持输入框焦点
      setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    } catch (error) {
      console.error("Error sending message:", error)
      toast({
        title: "发送失败",
        description: "消息发送失败，请重试",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } else if (diffDays === 1) {
      return "昨天"
    } else if (diffDays < 7) {
      const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
      return days[date.getDay()]
    } else {
      return date.toLocaleDateString()
    }
  }

  const isOnline = (lastSeen: string) => {
    const now = new Date()
    const lastSeenDate = new Date(lastSeen)
    const diffMinutes = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60))
    return diffMinutes < 5 // 5分钟内在线
  }

  // 判断是否需要显示用户信息（如果连续消息来自同一用户，只在第一条显示）
  const shouldShowUserInfo = (index: number) => {
    if (index === 0) return true
    return messages[index].sender_id !== messages[index - 1].sender_id
  }

  // 格式化ID为4位显示
  const formatId = (id: string) => {
    return id.padStart(4, "0")
  }

  // 处理输入框按键事件，支持Shift+Enter换行
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        e.preventDefault()
        const cursorPosition = e.currentTarget.selectionStart || 0
        const textBeforeCursor = newMessage.substring(0, cursorPosition)
        const textAfterCursor = newMessage.substring(cursorPosition)
        setNewMessage(textBeforeCursor + "\n" + textAfterCursor)

        // 设置光标位置到换行符后
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.selectionStart = cursorPosition + 1
            inputRef.current.selectionEnd = cursorPosition + 1
          }
        }, 0)
      } else {
        e.preventDefault()
        handleSendMessage()
      }
    }
  }

  // 加载表情包内容
  const loadEmojiPackContent = async (packId: string) => {
    const pack = emojiPacks.find((p) => p.id === packId)
    if (!pack || pack.emojis) return // 如果已经加载过，不再重复加载

    setIsLoadingEmojis(true)
    try {
      const response = await fetch(pack.url)
      const data = await response.json()

      // 获取表情包容器中的第一个键
      const firstKey = Object.keys(data)[0]
      const container = data[firstKey].container || []

      // 更新表情包数据
      setEmojiPacks((current) =>
        current.map((p) =>
          p.id === packId
            ? {
                ...p,
                emojis: container,
              }
            : p,
        ),
      )
    } catch (error) {
      console.error(`Error loading emoji pack ${packId}:`, error)
      toast({
        title: "加载失败",
        description: "无法加载表情包，请重试",
        variant: "destructive",
      })
    } finally {
      setIsLoadingEmojis(false)
    }
  }

  // 插入表情
  const insertEmoji = (emojiUrl: string) => {
    // 从HTML字符串中提取图片URL
    const urlMatch = emojiUrl.match(/src='([^']+)'/)
    if (!urlMatch || !urlMatch[1]) return

    const imgUrl = urlMatch[1]

    // 在光标位置插入表情图片URL
    const cursorPosition = inputRef.current?.selectionStart || newMessage.length
    const textBeforeCursor = newMessage.substring(0, cursorPosition)
    const textAfterCursor = newMessage.substring(cursorPosition)

    // 插入表情图片标记
    setNewMessage(textBeforeCursor + `[emoji:${imgUrl}]` + textAfterCursor)

    // 保持输入框焦点
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPosition = cursorPosition + `[emoji:${imgUrl}]`.length
        inputRef.current.focus()
        inputRef.current.selectionStart = newCursorPosition
        inputRef.current.selectionEnd = newCursorPosition
      }
    }, 0)
  }

  // 处理消息内容，支持表情显示
  const renderMessageContent = (content: string) => {
    // 分割文本和表情
    const parts = content.split(/(\[emoji:[^\]]+\])/g)

    return parts.map((part, index) => {
      // 检查是否是表情标记
      const emojiMatch = part.match(/\[emoji:([^\]]+)\]/)
      if (emojiMatch) {
        const emojiUrl = emojiMatch[1]
        return (
          <img
            key={index}
            src={emojiUrl || "/placeholder.svg"}
            alt="表情"
            className="inline-block h-6 align-middle mx-0.5"
            onError={(e) => {
              // 如果图片加载失败，显示文本
              e.currentTarget.outerHTML = "[表情]"
            }}
          />
        )
      }

      // 处理普通文本，支持换行
      return part.split("\n").map((line, i, arr) => (
        <span key={`${index}-${i}`}>
          {line}
          {i < arr.length - 1 && <br />}
        </span>
      ))
    })
  }

  const filteredFriends = friends.filter((friend) => friend.username.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="flex h-full">
      <div className="w-full md:w-80 border-r flex flex-col">
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索好友..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {filteredFriends.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">暂无好友，去添加好友吧！</div>
            ) : (
              filteredFriends.map((friend) => (
                <div key={friend.id}>
                  <Button
                    variant="ghost"
                    className={`w-full flex items-center justify-start gap-3 p-4 h-auto ${
                      selectedFriend?.id === friend.id ? "bg-muted" : ""
                    }`}
                    onClick={() => handleSelectFriend(friend)}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <SupabaseImage
                          src={friend.avatar_url}
                          bucket="avatars"
                          alt={friend.username}
                          className="h-full w-full object-cover"
                        />
                        <AvatarFallback>{friend.username[0]}</AvatarFallback>
                      </Avatar>
                      <span
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                          isOnline(friend.last_seen) ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                      {friend.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-white">
                          {friend.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{friend.username}</span>
                        <span className="text-xs text-muted-foreground">
                          {friend.last_message ? formatTime(friend.last_message.created_at) : ""}
                        </span>
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <span className="bg-muted px-1.5 py-0.5 rounded">ID: {formatId(friend.id)}</span>
                        <span className="ml-2">
                          {isOnline(friend.last_seen) ? "在线" : `${formatTime(friend.last_seen)}`}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {friend.last_message
                          ? friend.last_message.image_url &&
                            (!friend.last_message.content || friend.last_message.content === " ")
                            ? "[图片]"
                            : friend.last_message.content
                          : ""}
                      </p>
                    </div>
                  </Button>
                  <Separator className="my-1" />
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="hidden md:flex flex-col flex-1 h-full">
        {selectedFriend ? (
          <>
            <div className="p-4 border-b">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar>
                    <SupabaseImage
                      src={selectedFriend.avatar_url}
                      bucket="avatars"
                      alt={selectedFriend.username}
                      className="h-full w-full object-cover"
                    />
                    <AvatarFallback>{selectedFriend.username[0]}</AvatarFallback>
                  </Avatar>
                  <span
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                      isOnline(selectedFriend.last_seen) ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center">
                    <span className="font-medium">{selectedFriend.username}</span>
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded ml-2 text-muted-foreground">
                      ID: {formatId(selectedFriend.id)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isOnline(selectedFriend.last_seen) ? "在线" : `最后在线: ${formatTime(selectedFriend.last_seen)}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <ScrollArea className="h-[calc(100vh-160px)]">
                <div className="space-y-4 max-w-3xl mx-auto p-4">
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-[50vh] text-muted-foreground">
                      开始和 {selectedFriend.username} 聊天吧！
                    </div>
                  ) : (
                    messages.map((message, index) => (
                      <div key={message.id} className="flex flex-col">
                        {shouldShowUserInfo(index) && (
                          <div className="flex items-center mt-4 mb-1">
                            <Avatar className="h-8 w-8 mr-2">
                              <SupabaseImage
                                src={message.sender_id === user?.id ? user.avatar_url : selectedFriend.avatar_url}
                                bucket="avatars"
                                alt={message.sender_id === user?.id ? user.username : selectedFriend.username}
                                className="h-full w-full object-cover"
                              />
                              <AvatarFallback>
                                {message.sender_id === user?.id ? user.username[0] : selectedFriend.username[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex items-center">
                              <span className="font-medium text-sm">
                                {message.sender_id === user?.id ? `${user.username} (你)` : selectedFriend.username}
                              </span>
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded ml-2 text-muted-foreground">
                                ID: {formatId(message.sender_id)}
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {new Date(message.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className={`pl-10 ${!shouldShowUserInfo(index) ? "mt-1" : ""}`}>
                          {message.content && message.content !== " " && (
                            <p className="text-sm break-words whitespace-pre-wrap">
                              {renderMessageContent(message.content)}
                            </p>
                          )}
                          {message.image_url && (
                            <div className="mt-2 max-w-md">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <div className="cursor-pointer relative group inline-block">
                                    <SupabaseImage
                                      src={message.image_url}
                                      bucket="chat_images"
                                      alt="消息图片"
                                      className="rounded-lg max-h-60 object-contain max-w-full border border-border shadow-sm group-hover:shadow-md transition-shadow"
                                      style={{ maxWidth: "300px" }}
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-lg">
                                      <ExternalLink className="h-6 w-6 text-white drop-shadow-md" />
                                    </div>
                                  </div>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl">
                                  <div className="flex justify-center">
                                    <SupabaseImage
                                      src={message.image_url}
                                      bucket="chat_images"
                                      alt="消息图片"
                                      className="max-h-[80vh] object-contain rounded-lg"
                                    />
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </div>

            <div className="p-4 border-t mt-auto">
              <div className="flex gap-2 max-w-3xl mx-auto">
                <ImageUpload
                  onImageUploaded={(url) => setImageUrl(url)}
                  bucket="chat_images"
                  previewUrl={imageUrl}
                  onClear={() => setImageUrl(null)}
                />

                <Popover onOpenChange={(open) => {
                  if (open && emojiPacks.length > 0) {
                    loadEmojiPackContent(emojiPacks[0].id)
                  }
                }}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="h-10 w-10">
                      <Smile className="h-5 w-5" />
                      <span className="sr-only">选择表情</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    {emojiPacks.length > 0 ? (
                      <Tabs defaultValue={emojiPacks[0].id} onValueChange={loadEmojiPackContent}>
                        <TabsList className="w-full justify-start overflow-x-auto">
                          {emojiPacks.map((pack) => (
                            <TabsTrigger key={pack.id} value={pack.id} className="text-xs">
                              {pack.name}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        <Separator />
                        <ScrollArea className="h-60">
                          {emojiPacks.map((pack) => (
                            <TabsContent key={pack.id} value={pack.id} className="p-2">
                              {isLoadingEmojis ? (
                                <div className="flex items-center justify-center h-full">
                                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                                </div>
                              ) : pack.emojis ? (
                                <div className="grid grid-cols-6 gap-1">
                                  {pack.emojis.map((emoji, index) => (
                                    <Button
                                      key={index}
                                      variant="ghost"
                                      size="sm"
                                      className="h-10 w-10 p-1"
                                      onClick={() => insertEmoji(emoji.icon)}
                                    >
                                      <div dangerouslySetInnerHTML={{ __html: emoji.icon }} />
                                    </Button>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                  点击加载表情包
                                </div>
                              )}
                            </TabsContent>
                          ))}
                        </ScrollArea>
                      </Tabs>
                    ) : (
                      <div className="p-4 text-center text-muted-foreground">暂无表情包</div>
                    )}
                  </PopoverContent>
                </Popover>

                <Input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="输入消息... (Shift+Enter 换行)"
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button onClick={handleSendMessage} size="icon" disabled={isLoading}>
                  <Send className="h-5 w-5" />
                  <span className="sr-only">发送</span>
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">选择一个好友开始聊天</div>
        )}
      </div>
    </div>
  )
}
