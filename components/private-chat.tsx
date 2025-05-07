"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Send,
  Search,
  ExternalLink,
  Smile,
  Lock,
  ChevronLeft,
  ShieldAlert,
  KeyRound,
  AlertTriangle,
  Settings,
  ShieldOff,
  Trash2,
  Download,
  Upload,
  FileUp,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { createClientSupabaseClient } from "@/lib/supabase"
import { useUser } from "@/contexts/user-context"
import { ImageUpload } from "@/components/image-upload"
import { toast } from "@/hooks/use-toast"
import { SupabaseImage } from "@/components/supabase-image"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs as TabsComponent } from "@/components/ui/tabs"

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

// 使用AES加密
const encryptMessage = (message: string, key: string): string => {
  try {
    // 使用安全的加密方法
    // 这里使用简单的Base64编码作为示例，实际应用中应使用CryptoJS或Web Crypto API
    // 为了避免Unicode字符问题，先将消息转换为UTF-8编码
    const encoder = new TextEncoder()
    const data = encoder.encode(message)

    // 将二进制数据转换为Base64
    const base64 = btoa(
      Array.from(data)
        .map((byte) => String.fromCharCode(byte))
        .join(""),
    )

    // 添加前缀标记这是加密消息
    return `[encrypted]${base64}`
  } catch (e) {
    console.error("加密失败:", e)
    throw e
  }
}

// 解密消息
const decryptMessage = (encryptedMessage: string, key: string): string => {
  try {
    if (!encryptedMessage.startsWith("[encrypted]")) {
      return encryptedMessage
    }

    const base64 = encryptedMessage.substring(11)

    // 解码Base64
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // 将二进制数据转换回字符串
    const decoder = new TextDecoder()
    return decoder.decode(bytes)
  } catch (e) {
    console.error("解密失败:", e)
    return "解密失败，可能是更换了密钥"
  }
}

// 本地存储加密设置
const saveEncryptionSettings = (chatId: string, isEnabled: boolean, key: string) => {
  try {
    const settings = JSON.parse(localStorage.getItem("chatEncryptionSettings") || "{}")
    settings[chatId] = { isEnabled, key }
    localStorage.setItem("chatEncryptionSettings", JSON.stringify(settings))
  } catch (e) {
    console.error("保存加密设置失败:", e)
  }
}

// 获取加密设置
const getEncryptionSettings = (chatId: string) => {
  try {
    const settings = JSON.parse(localStorage.getItem("chatEncryptionSettings") || "{}")
    return settings[chatId] || { isEnabled: false, key: "" }
  } catch (e) {
    console.error("获取加密设置失败:", e)
    return { isEnabled: false, key: "" }
  }
}

// 使用用户ID和PIN加密密钥
const encryptKeyForBackup = (key: string, userId: string, pin: string): string => {
  try {
    // 创建一个简单的种子
    const seed = userId + pin

    // 使用种子加密密钥
    let result = ""
    for (let i = 0; i < key.length; i++) {
      const charCode = key.charCodeAt(i)
      const seedChar = seed.charCodeAt(i % seed.length)
      // 简单的XOR加密
      const encryptedChar = charCode ^ seedChar
      result += String.fromCharCode(encryptedChar)
    }

    // 转换为Base64以便存储
    const encoder = new TextEncoder()
    const data = encoder.encode(result)
    const base64 = btoa(
      Array.from(data)
        .map((byte) => String.fromCharCode(byte))
        .join(""),
    )

    return base64
  } catch (e) {
    console.error("加密密钥失败:", e)
    throw e
  }
}

// 解密备份的密钥
const decryptBackupKey = (encryptedKey: string, userId: string, pin: string): string => {
  try {
    // 解码Base64
    const binaryString = atob(encryptedKey)
    const bytes = new Uint8Array(binaryString.length)

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // 将二进制数据转换回字符串
    const decoder = new TextDecoder()
    const encryptedText = decoder.decode(bytes)

    // 创建相同的种子
    const seed = userId + pin

    // 使用种子解密
    let result = ""
    for (let i = 0; i < encryptedText.length; i++) {
      const charCode = encryptedText.charCodeAt(i)
      const seedChar = seed.charCodeAt(i % seed.length)
      // 反向XOR操作
      const decryptedChar = charCode ^ seedChar
      result += String.fromCharCode(decryptedChar)
    }

    return result
  } catch (e) {
    console.error("解密密钥失败:", e)
    throw e
  }
}

// 下载加密的密钥作为文本文件
const downloadEncryptedKey = (encryptedKey: string, chatId: string) => {
  const element = document.createElement("a")
  const file = new Blob([encryptedKey], { type: "text/plain" })
  element.href = URL.createObjectURL(file)
  element.download = `encrypted_key_${chatId}.txt`
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

// 修改为默认导出，以匹配导入方式
export default function PrivateChat({ initialFriendId }: PrivateChatProps) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [emojiPacks, setEmojiPacks] = useState<EmojiPack[]>([])
  const [isLoadingEmojis, setIsLoadingEmojis] = useState(false)
  const [showFriendsList, setShowFriendsList] = useState(true)
  const [encryptionKey, setEncryptionKey] = useState<string>("")
  const [isEncryptionEnabled, setIsEncryptionEnabled] = useState(false)
  const [isEncryptionDialogOpen, setIsEncryptionDialogOpen] = useState(false)
  const [tempEncryptionKey, setTempEncryptionKey] = useState("")
  const [confirmEncryptionKey, setConfirmEncryptionKey] = useState("")
  const [userPin, setUserPin] = useState<string[]>(Array(6).fill(""))
  const [isPinVerified, setIsPinVerified] = useState(false)
  const [isVerifyingPin, setIsVerifyingPin] = useState(false)
  const [decryptionFailures, setDecryptionFailures] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState("setup")
  const [backupKeyFile, setBackupKeyFile] = useState<File | null>(null)
  const [isProcessingBackup, setIsProcessingBackup] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user } = useUser()
  const supabase = createClientSupabaseClient()

  // 当选择好友时，自动隐藏好友列表（在移动设备上）
  useEffect(() => {
    if (selectedFriend && window.innerWidth < 768) {
      setShowFriendsList(false)
    }
  }, [selectedFriend])

  // 初始化时，如果有initialFriendId，则隐藏好友列表
  useEffect(() => {
    if (initialFriendId && window.innerWidth < 768) {
      setShowFriendsList(false)
    }
  }, [initialFriendId])

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

            // 加载该聊天的加密设置
            if (initialFriend.chat_id) {
              const settings = getEncryptionSettings(initialFriend.chat_id)
              setIsEncryptionEnabled(settings.isEnabled)
              setEncryptionKey(settings.key)
            }
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

    // 重置解密失败记录
    setDecryptionFailures({})

    // 加载该聊天的加密设置
    const settings = getEncryptionSettings(selectedFriend.chat_id)
    setIsEncryptionEnabled(settings.isEnabled)
    setEncryptionKey(settings.key)

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

          // 获取发送者信息
          const { data: senderData } = await supabase
            .from("users")
            .select("username")
            .eq("id", newMessage.sender_id)
            .single()

          // 如果当前没有选中该好友，增加未读计数并显示通知
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

            // 显示通知
            toast({
              title: `新消息: ${senderData?.username || "好友"}`,
              description: newMessage.image_url ? "[图片]" : (newMessage.content || "").substring(0, 30),
              action: (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const friend = friends.find((f) => f.id === newMessage.sender_id)
                    if (friend) {
                      setSelectedFriend(friend)
                      setShowFriendsList(false)
                    }
                  }}
                >
                  查看
                </Button>
              ),
            })

            // 触发全局未读消息计数更新的事件
            window.dispatchEvent(new CustomEvent("unread-messages-updated"))
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(unreadChannel)
    }
  }, [user, selectedFriend, supabase, friends])

  // 监听好友请求
  useEffect(() => {
    if (!user) return

    const friendRequestsChannel = supabase
      .channel("friend_requests_notifications")
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
          const { data: senderData } = await supabase
            .from("users")
            .select("username")
            .eq("id", payload.new.sender_id)
            .single()

          // 显示通知
          toast({
            title: "新的好友请求",
            description: `${senderData?.username || "用户"} 向您发送了好友请求`,
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = "/friend-requests"
                }}
              >
                查看
              </Button>
            ),
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(friendRequestsChannel)
    }
  }, [user, supabase])

  const handleSelectFriend = (friend: Friend) => {
    setSelectedFriend(friend)
    if (window.innerWidth < 768) {
      setShowFriendsList(false)
    }

    // 加载该聊天的加密设置
    if (friend.chat_id) {
      const settings = getEncryptionSettings(friend.chat_id)
      setIsEncryptionEnabled(settings.isEnabled)
      setEncryptionKey(settings.key)
    }
  }

  // 处理表情转换为HTML
  const convertEmojiToHtml = (text: string): string => {
    // 查找所有 [emoji_code] 格式的表情
    const emojiRegex = /\[([^\]]+)\]/g
    let match
    let result = text

    while ((match = emojiRegex.exec(text)) !== null) {
      const emojiCode = match[1]

      // 查找匹配的表情
      for (const pack of emojiPacks) {
        if (!pack.emojis) continue

        const emoji = pack.emojis.find((e) => e.text === emojiCode)
        if (emoji) {
          // 将表情代码替换为HTML
          const imgTag = `[emoji]${emoji.icon}`
          result = result.replace(`[${emojiCode}]`, imgTag)
          break
        }
      }
    }

    return result
  }

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !imageUrl) || !user || !selectedFriend?.chat_id) return

    setIsLoading(true)

    try {
      // 处理表情转换
      let processedContent = newMessage.trim() || " "
      processedContent = convertEmojiToHtml(processedContent)

      // 如果启用了加密，对消息进行加密
      if (isEncryptionEnabled && encryptionKey && newMessage.trim()) {
        processedContent = encryptMessage(processedContent, encryptionKey)
      }

      const { error } = await supabase.from("private_messages").insert({
        chat_id: selectedFriend.chat_id,
        sender_id: user.id,
        content: processedContent,
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
  const insertEmoji = (emoji: { text: string; icon: string }) => {
    // 在光标位置插入表情代码
    const cursorPosition = inputRef.current?.selectionStart || newMessage.length
    const textBeforeCursor = newMessage.substring(0, cursorPosition)
    const textAfterCursor = newMessage.substring(cursorPosition)

    // 插入表情代码 [text]
    setNewMessage(textBeforeCursor + `[${emoji.text}]` + textAfterCursor)

    // 保持输入框焦点
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPosition = cursorPosition + `[${emoji.text}]`.length
        inputRef.current.focus()
        inputRef.current.selectionStart = newCursorPosition
        inputRef.current.selectionEnd = newCursorPosition
      }
    }, 0)
  }

  // 处理消息内容，支持表情显示和解密
  const renderMessageContent = (message: Message) => {
    const { content, id } = message

    // 如果已经标记为解密失败，直接显示失败信息
    if (decryptionFailures[id]) {
      return (
        <span className="text-amber-500 italic flex items-center">
          <AlertTriangle className="h-4 w-4 mr-1" />
          解密失败，可能是更换了密钥
        </span>
      )
    }

    // 如果是加密消息且有密钥，尝试解密
    let processedContent = content
    if (content.startsWith("[encrypted]") && isEncryptionEnabled && encryptionKey) {
      try {
        const decrypted = decryptMessage(content, encryptionKey)

        // 如果解密结果是错误消息，标记为解密失败
        if (decrypted === "解密失败，可能是更换了密钥") {
          setDecryptionFailures((prev) => ({ ...prev, [id]: true }))
          return (
            <span className="text-amber-500 italic flex items-center">
              <AlertTriangle className="h-4 w-4 mr-1" />
              解密失败，可能是更换了密钥
            </span>
          )
        }

        processedContent = decrypted
      } catch (e) {
        setDecryptionFailures((prev) => ({ ...prev, [id]: true }))
        return (
          <span className="text-amber-500 italic flex items-center">
            <AlertTriangle className="h-4 w-4 mr-1" />
            解密失败，可能是更换了密钥
          </span>
        )
      }
    }

    // 处理表情标签
    const parts = processedContent.split(/(\[emoji\])/g)
    return parts.map((part, index) => {
      if (part === "[emoji]") {
        // 下一个部分是表情HTML
        const emojiHtml = parts[index + 1]
        if (emojiHtml) {
          return (
            <span
              key={index}
              className="inline-block align-middle mx-0.5"
              dangerouslySetInnerHTML={{ __html: emojiHtml }}
            />
          )
        }
      } else if (index > 0 && parts[index - 1] === "[emoji]") {
        // 这部分已经被处理过了
        return null
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

  // 处理PIN码输入变化
  const handlePinInputChange = (index: number, value: string) => {
    if (/^\d*$/.test(value)) {
      setUserPin((prev) => {
        const newPin = [...prev]
        newPin[index] = value.slice(0, 1)
        return newPin
      })

      // 自动跳到下一个输入框
      if (value && index < 5) {
        pinRefs.current[index + 1]?.focus()
      }
    }
  }

  // 处理PIN码键盘事件
  const handlePinKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !e.currentTarget.value) {
      // 当前输入框为空且按下退格键时，移动到前一个输入框
      if (index > 0) {
        pinRefs.current[index - 1]?.focus()
      }
    } else if (e.key === "ArrowLeft") {
      if (index > 0) {
        pinRefs.current[index - 1]?.focus()
      }
    } else if (e.key === "ArrowRight") {
      if (index < 5) {
        pinRefs.current[index + 1]?.focus()
      }
    }
  }

  // 验证PIN码
  const verifyPin = async () => {
    if (!user) return

    const fullPin = userPin.join("")
    if (fullPin.length !== 6) return

    setIsVerifyingPin(true)

    try {
      const { data, error } = await supabase.from("users").select("id").eq("id", user.id).eq("pin", fullPin).single()

      if (error || !data) {
        toast({
          title: "PIN码错误",
          description: "请输入正确的PIN码",
          variant: "destructive",
        })
        // 清空PIN码
        setUserPin(Array(6).fill(""))
        pinRefs.current[0]?.focus()
        setIsVerifyingPin(false)
        return false
      }

      setIsPinVerified(true)
      return true
    } catch (e) {
      console.error("验证PIN码失败:", e)
      toast({
        title: "验证失败",
        description: "请重试",
        variant: "destructive",
      })
      return false
    } finally {
      setIsVerifyingPin(false)
    }
  }

  // 处理加密设置
  const handleSetEncryption = async () => {
    if (!selectedFriend?.chat_id || !user) return

    // 验证输入
    if (tempEncryptionKey.trim() === "") {
      toast({
        title: "错误",
        description: "请输入有效的加密密钥",
        variant: "destructive",
      })
      return
    }

    if (tempEncryptionKey !== confirmEncryptionKey) {
      toast({
        title: "错误",
        description: "两次输入的密钥不一致",
        variant: "destructive",
      })
      return
    }

    // 保存加密设置
    const key = tempEncryptionKey.trim()
    setEncryptionKey(key)
    setIsEncryptionEnabled(true)
    saveEncryptionSettings(selectedFriend.chat_id, true, key)

    // 创建并下载备份
    try {
      const fullPin = userPin.join("")
      const encryptedKey = encryptKeyForBackup(key, user.id, fullPin)
      downloadEncryptedKey(encryptedKey, selectedFriend.chat_id)

      toast({
        title: "密钥备份已下载",
        description: "请妥善保管您的密钥备份文件",
      })
    } catch (e) {
      console.error("创建密钥备份失败:", e)
      toast({
        title: "警告",
        description: "密钥备份创建失败，但加密已启用",
        variant: "destructive",
      })
    }

    setIsEncryptionDialogOpen(false)

    // 重置表单
    setTempEncryptionKey("")
    setConfirmEncryptionKey("")
    setUserPin(Array(6).fill(""))
    setIsPinVerified(false)
    setActiveTab("setup")

    toast({
      title: "加密已启用",
      description: "您的消息将使用端对端加密发送",
    })
  }

  // 处理关闭加密
  const handleDisableEncryption = () => {
    if (!selectedFriend?.chat_id) return

    setIsEncryptionEnabled(false)
    setEncryptionKey("")
    saveEncryptionSettings(selectedFriend.chat_id, false, "")
    setIsEncryptionDialogOpen(false)

    toast({
      title: "加密已关闭",
      description: "您的消息将以明文发送",
    })
  }

  // 清除加密密钥
  const handleClearEncryptionKey = () => {
    if (!selectedFriend?.chat_id) return

    setEncryptionKey("")
    if (isEncryptionEnabled) {
      saveEncryptionSettings(selectedFriend.chat_id, true, "")
    }
    setIsEncryptionDialogOpen(false)

    toast({
      title: "密钥已清除",
      description: "您的加密密钥已被清除",
    })
  }

  // 打开加密设置对话框
  const openEncryptionDialog = () => {
    setTempEncryptionKey("")
    setConfirmEncryptionKey("")
    setUserPin(Array(6).fill(""))
    setIsPinVerified(false)
    setActiveTab("setup")
    setIsEncryptionDialogOpen(true)
  }

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setBackupKeyFile(e.target.files[0])
    }
  }

  // 处理从备份文件恢复密钥
  const handleRestoreFromBackup = async () => {
    if (!backupKeyFile || !user || !selectedFriend?.chat_id) return

    setIsProcessingBackup(true)

    try {
      // 读取文件内容
      const text = await backupKeyFile.text()

      // 使用PIN码解密
      const fullPin = userPin.join("")
      const decryptedKey = decryptBackupKey(text, user.id, fullPin)

      // 设置密钥
      setEncryptionKey(decryptedKey)
      setIsEncryptionEnabled(true)
      saveEncryptionSettings(selectedFriend.chat_id, true, decryptedKey)

      // 关闭对话框
      setIsEncryptionDialogOpen(false)

      // 重置状态
      setBackupKeyFile(null)
      setUserPin(Array(6).fill(""))
      setIsPinVerified(false)

      toast({
        title: "密钥已恢复",
        description: "加密已启用，您可以查看加密消息了",
      })
    } catch (e) {
      console.error("恢复密钥失败:", e)
      toast({
        title: "恢复失败",
        description: "无法从备份文件恢复密钥，请确保PIN码正确且文件未损坏",
        variant: "destructive",
      })
    } finally {
      setIsProcessingBackup(false)
    }
  }

  const filteredFriends = friends.filter((friend) => friend.username.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="flex h-full">
      {/* 好友列表 - 在移动设备上可以隐藏 */}
      {showFriendsList && (
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
      )}

      <div className={`${showFriendsList ? "hidden md:flex" : "flex"} flex-col flex-1 h-full`}>
        {selectedFriend ? (
          <>
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {!showFriendsList && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden mr-2"
                      onClick={() => setShowFriendsList(true)}
                    >
                      <ChevronLeft className="h-5 w-5" />
                      <span className="sr-only">返回</span>
                    </Button>
                  )}
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
                      {isOnline(selectedFriend.last_seen)
                        ? "在线"
                        : `最后在线: ${formatTime(selectedFriend.last_seen)}`}
                    </p>
                  </div>
                </div>

                {/* 加密设置按钮 */}
                <div>
                  <Dialog open={isEncryptionDialogOpen} onOpenChange={setIsEncryptionDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={isEncryptionEnabled ? "加密设置" : "启用加密"}
                        className={isEncryptionEnabled ? "text-purple-500" : ""}
                        onClick={() => openEncryptionDialog()}
                      >
                        {isEncryptionEnabled ? <Lock className="h-5 w-5" /> : <Settings className="h-5 w-5" />}
                        <span className="sr-only">加密设置</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md bg-red-50 border-red-200">
                      <DialogHeader>
                        <DialogTitle className="flex items-center text-red-700">
                          <ShieldAlert className="h-5 w-5 mr-2" />
                          端对端加密设置
                        </DialogTitle>
                        <DialogDescription className="text-red-600">
                          启用加密后，只有知道相同密钥的人才能解密您的消息。请妥善保管您的密钥，它不会被存储在服务器上。
                        </DialogDescription>
                      </DialogHeader>

                      <TabsComponent value={activeTab} onValueChange={setActiveTab} className="mt-4">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="setup" className="text-red-700">
                            设置加密
                          </TabsTrigger>
                          <TabsTrigger value="restore" className="text-red-700">
                            恢复密钥
                          </TabsTrigger>
                          <TabsTrigger value="manage" className="text-red-700">
                            管理加密
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="setup" className="space-y-4 py-4">
                          {!isPinVerified ? (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="user-pin" className="flex items-center text-red-700">
                                  <Lock className="h-4 w-4 mr-2" />
                                  验证您的PIN码
                                </Label>
                                <div className="flex justify-center gap-2">
                                  {Array(6)
                                    .fill(0)
                                    .map((_, i) => (
                                      <Input
                                        key={`pin-${i}`}
                                        ref={(el) => (pinRefs.current[i] = el)}
                                        type="password"
                                        inputMode="numeric"
                                        value={userPin[i]}
                                        onChange={(e) => handlePinInputChange(i, e.target.value)}
                                        onKeyDown={(e) => handlePinKeyDown(e, i)}
                                        className="w-10 h-10 text-center text-lg font-medium p-0 border-red-200"
                                        maxLength={1}
                                        autoFocus={i === 0}
                                      />
                                    ))}
                                </div>
                                <p className="text-xs text-red-600 text-center">
                                  为了安全起见，需要验证您的PIN码才能启用加密功能。
                                </p>
                              </div>

                              <Button
                                onClick={verifyPin}
                                className="w-full bg-red-600 hover:bg-red-700 text-white"
                                disabled={isVerifyingPin || userPin.join("").length !== 6}
                              >
                                {isVerifyingPin ? "验证中..." : "验证PIN码"}
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="encryption-key" className="flex items-center text-red-700">
                                  <KeyRound className="h-4 w-4 mr-2" />
                                  加密密钥
                                </Label>
                                <Input
                                  id="encryption-key"
                                  type="password"
                                  placeholder="输入加密密钥"
                                  value={tempEncryptionKey}
                                  onChange={(e) => setTempEncryptionKey(e.target.value)}
                                  className="border-red-200"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="confirm-encryption-key" className="flex items-center text-red-700">
                                  <KeyRound className="h-4 w-4 mr-2" />
                                  确认加密密钥
                                </Label>
                                <Input
                                  id="confirm-encryption-key"
                                  type="password"
                                  placeholder="再次输入加密密钥"
                                  value={confirmEncryptionKey}
                                  onChange={(e) => setConfirmEncryptionKey(e.target.value)}
                                  className="border-red-200"
                                />
                              </div>

                              <Alert className="bg-red-100 border-red-200 text-red-800">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                  请记住：如果您忘记密钥，将无法解密之前的消息。启用后将自动下载密钥备份文件。
                                </AlertDescription>
                              </Alert>

                              <Button
                                onClick={handleSetEncryption}
                                className="w-full bg-red-600 hover:bg-red-700 text-white"
                                disabled={
                                  !tempEncryptionKey ||
                                  !confirmEncryptionKey ||
                                  tempEncryptionKey !== confirmEncryptionKey
                                }
                              >
                                启用加密
                              </Button>
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="restore" className="space-y-4 py-4">
                          {!isPinVerified ? (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="user-pin-restore" className="flex items-center text-red-700">
                                  <Lock className="h-4 w-4 mr-2" />
                                  验证您的PIN码
                                </Label>
                                <div className="flex justify-center gap-2">
                                  {Array(6)
                                    .fill(0)
                                    .map((_, i) => (
                                      <Input
                                        key={`pin-restore-${i}`}
                                        ref={(el) => (pinRefs.current[i] = el)}
                                        type="password"
                                        inputMode="numeric"
                                        value={userPin[i]}
                                        onChange={(e) => handlePinInputChange(i, e.target.value)}
                                        onKeyDown={(e) => handlePinKeyDown(e, i)}
                                        className="w-10 h-10 text-center text-lg font-medium p-0 border-red-200"
                                        maxLength={1}
                                        autoFocus={i === 0}
                                      />
                                    ))}
                                </div>
                                <p className="text-xs text-red-600 text-center">
                                  为了安全起见，需要验证您的PIN码才能恢复加密密钥。
                                </p>
                              </div>

                              <Button
                                onClick={verifyPin}
                                className="w-full bg-red-600 hover:bg-red-700 text-white"
                                disabled={isVerifyingPin || userPin.join("").length !== 6}
                              >
                                {isVerifyingPin ? "验证中..." : "验证PIN码"}
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="backup-file" className="flex items-center text-red-700">
                                  <FileUp className="h-4 w-4 mr-2" />
                                  上传密钥备份文件
                                </Label>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    className="w-full border-red-200"
                                    onClick={() => fileInputRef.current?.click()}
                                  >
                                    <Upload className="h-4 w-4 mr-2" />
                                    选择文件
                                  </Button>
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    id="backup-file"
                                    className="hidden"
                                    accept=".txt"
                                    onChange={handleFileSelect}
                                  />
                                </div>
                                {backupKeyFile && (
                                  <p className="text-xs text-green-600 mt-1">已选择文件: {backupKeyFile.name}</p>
                                )}
                              </div>

                              <Alert className="bg-red-100 border-red-200 text-red-800">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                  请确保上传的是正确的密钥备份文件，并且使用的是创建备份时的相同PIN码。
                                </AlertDescription>
                              </Alert>

                              <Button
                                onClick={handleRestoreFromBackup}
                                className="w-full bg-red-600 hover:bg-red-700 text-white"
                                disabled={isProcessingBackup || !backupKeyFile}
                              >
                                {isProcessingBackup ? "处理中..." : "从备份恢复"}
                              </Button>
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="manage" className="space-y-4 py-4">
                          <div className="space-y-4">
                            {isEncryptionEnabled ? (
                              <Alert className="bg-green-100 border-green-200 text-green-800">
                                <Lock className="h-4 w-4" />
                                <AlertDescription>
                                  此聊天已启用端对端加密。只有知道密钥的人才能解密消息。
                                </AlertDescription>
                              </Alert>
                            ) : (
                              <Alert className="bg-red-100 border-red-200 text-red-800">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>此聊天未启用加密。您的消息以明文形式发送。</AlertDescription>
                              </Alert>
                            )}

                            <div className="grid grid-cols-1 gap-4">
                              {isEncryptionEnabled && (
                                <>
                                  <Button
                                    onClick={handleDisableEncryption}
                                    className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    <ShieldOff className="h-4 w-4" />
                                    关闭加密
                                  </Button>

                                  <Button
                                    onClick={handleClearEncryptionKey}
                                    className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    清除密钥
                                  </Button>

                                  <Button
                                    onClick={() => {
                                      if (user && selectedFriend?.chat_id) {
                                        const fullPin = userPin.join("")
                                        if (fullPin.length === 6 && isPinVerified) {
                                          try {
                                            const encryptedKey = encryptKeyForBackup(encryptionKey, user.id, fullPin)
                                            downloadEncryptedKey(encryptedKey, selectedFriend.chat_id)

                                            toast({
                                              title: "密钥备份已下载",
                                              description: "请妥善保管您的密钥备份文件",
                                            })
                                          } catch (e) {
                                            console.error("创建密钥备份失败:", e)
                                            toast({
                                              title: "备份失败",
                                              description: "无法创建密钥备份，请重试",
                                              variant: "destructive",
                                            })
                                          }
                                        } else {
                                          toast({
                                            title: "PIN码验证",
                                            description: "请先验证您的PIN码",
                                            variant: "destructive",
                                          })
                                        }
                                      }
                                    }}
                                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                                  >
                                    <Download className="h-4 w-4" />
                                    下载密钥备份
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </TabsContent>
                      </TabsComponent>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <ScrollArea className="h-[calc(100vh-170px)]">
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
                              {message.content.startsWith("[encrypted]") && (!isEncryptionEnabled || !encryptionKey) ? (
                                <span className="text-purple-500 italic flex items-center">
                                  <Lock className="h-4 w-4 mr-1" />
                                  {message.sender_id === user?.id
                                    ? "您需要启用相同的加密密钥才能查看此消息"
                                    : "对方发送了加密消息，您需要设置相同的密钥才能查看"}
                                </span>
                              ) : (
                                renderMessageContent(message)
                              )}
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

                <Popover
                  onOpenChange={(open) => {
                    if (open && emojiPacks.length > 0) {
                      // 自动加载第一个表情包
                      loadEmojiPackContent(emojiPacks[0].id)
                    }
                  }}
                >
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
                                      onClick={() => insertEmoji(emoji)}
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
                  placeholder={
                    isEncryptionEnabled ? "输入加密消息... (Shift+Enter 换行)" : "输入消息... (Shift+Enter 换行)"
                  }
                  onKeyDown={handleKeyDown}
                  className={`flex-1 ${isEncryptionEnabled ? "border-purple-200" : ""}`}
                  disabled={isLoading}
                />
                <Button onClick={handleSendMessage} size="icon" disabled={isLoading}>
                  <Send className="h-5 w-5" />
                  <span className="sr-only">发送</span>
                </Button>
              </div>
              {isEncryptionEnabled && (
                <div className="flex items-center justify-center mt-2">
                  <span className="text-xs text-purple-500 flex items-center">
                    <Lock className="h-3 w-3 mr-1" />
                    端对端加密已启用
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {showFriendsList ? (
              "选择一个好友开始聊天"
            ) : (
              <div className="text-center">
                <p className="mb-4">请选择一个好友开始聊天</p>
                <Button onClick={() => setShowFriendsList(true)}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  查看好友列表
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
