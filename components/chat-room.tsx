"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, AlertCircle, ExternalLink, Smile } from "lucide-react"
import { createClientSupabaseClient } from "@/lib/supabase"
import { useUser } from "@/contexts/user-context"
import { ImageUpload } from "@/components/image-upload"
import { toast } from "@/hooks/use-toast"
import { SupabaseImage } from "@/components/supabase-image"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

type Message = {
  id: string
  user_id: string
  content: string
  image_url: string | null
  created_at: string
  user: {
    username: string
    avatar_url: string | null
  }
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

export function ChatRoom() {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showSecurityAlert, setShowSecurityAlert] = useState(true)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [emojiPacks, setEmojiPacks] = useState<EmojiPack[]>([])
  const [isLoadingEmojis, setIsLoadingEmojis] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { user } = useUser()
  const supabase = createClientSupabaseClient()

  // 检查是否已经显示过安全提示
  useEffect(() => {
    const hasSeenAlert = localStorage.getItem("chat-security-notice-seen")
    if (hasSeenAlert === "true") {
      setShowSecurityAlert(false)
    }
  }, [])

  // 关闭安全提示
  const handleCloseAlert = () => {
    setShowSecurityAlert(false)
    localStorage.setItem("chat-security-notice-seen", "true")
  }

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

  // 加载消息并设置实时订阅
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("public_messages")
          .select(`
            id,
            user_id,
            content,
            image_url,
            created_at,
            users (
              username,
              avatar_url
            )
          `)
          .order("created_at", { ascending: true })
          .limit(50)

        if (error) throw error

        // 转换数据格式
        const formattedMessages = data.map((message) => ({
          id: message.id,
          user_id: message.user_id,
          content: message.content,
          image_url: message.image_url,
          created_at: message.created_at,
          user: {
            username: message.users.username,
            avatar_url: message.users.avatar_url,
          },
        }))

        setMessages(formattedMessages)
      } catch (error) {
        console.error("Error fetching messages:", error)
      }
    }

    fetchMessages()

    // 设置实时订阅
    const channel = supabase
      .channel("public_chat")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "public_messages",
        },
        async (payload) => {
          // 获取新消息的用户信息
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("username, avatar_url")
            .eq("id", payload.new.user_id)
            .single()

          if (userError) {
            console.error("Error fetching user data:", userError)
            return
          }

          const newMessage = {
            id: payload.new.id,
            user_id: payload.new.user_id,
            content: payload.new.content,
            image_url: payload.new.image_url,
            created_at: payload.new.created_at,
            user: {
              username: userData.username,
              avatar_url: userData.avatar_url,
            },
          }

          setMessages((current) => [...current, newMessage])

          // 滚动到底部
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
          }, 100)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, user?.id])

  // 初始加载时滚动到底部
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView()
    }, 100)
  }, [])

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !imageUrl) || !user) return

    setIsLoading(true)

    try {
      const { error } = await supabase.from("public_messages").insert({
        user_id: user.id,
        content: newMessage.trim() || " ",
        image_url: imageUrl,
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
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // 判断是否需要显示用户信息（如果连续消息来自同一用户，只在第一条显示）
  const shouldShowUserInfo = (index: number) => {
    if (index === 0) return true
    return messages[index].user_id !== messages[index - 1].user_id
  }

  // 格式化ID为4位显示
  const formatId = (id: string) => {
    return id.padStart(4, "0")
  }

  // 处理消息内容，支持换行显示
  const formatMessageContent = (content: string) => {
    return content.split("\n").map((line, i) => (
      <span key={i}>
        {line}
        {i < content.split("\n").length - 1 && <br />}
      </span>
    ))
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

  return (
    <div className="flex flex-col h-full">
      {showSecurityAlert && (
        <div className="px-4 pt-4">
          <Alert variant="default" className="relative flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            <div className="flex-1">
              <AlertTitle className="text-sm font-medium mb-1">安全提示</AlertTitle>
              <AlertDescription className="text-sm">
                请注意，公共聊天室中的消息对所有用户可见。请勿在此分享个人敏感信息。
              </AlertDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleCloseAlert} className="ml-2 shrink-0">
              不再提示
            </Button>
          </Alert>
        </div>
      )}

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="space-y-4 max-w-3xl mx-auto p-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-[50vh] text-muted-foreground">
                暂无消息，发送第一条消息开始聊天吧！
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={message.id} className="flex flex-col">
                  {shouldShowUserInfo(index) && (
                    <div className="flex items-center mt-4 mb-1">
                      <Avatar className="h-8 w-8 mr-2">
                        {message.user.avatar_url ? (
                          <SupabaseImage
                            src={message.user.avatar_url}
                            bucket="avatars"
                            alt={message.user.username}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <AvatarFallback>{message.user.username[0]}</AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex items-center">
                        <span className="font-medium text-sm">
                          {message.user.username}
                          {message.user_id === user?.id && " (你)"}
                        </span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded ml-2 text-muted-foreground">
                          ID: {formatId(message.user_id)}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">{formatTime(message.created_at)}</span>
                      </div>
                    </div>
                  )}
                  <div className={`pl-10 ${!shouldShowUserInfo(index) ? "mt-1" : ""}`}>
                    {message.content && message.content !== " " && (
                      <p className="text-sm break-words whitespace-pre-wrap">{renderMessageContent(message.content)}</p>
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

          <Popover>
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
    </div>
  )
}
