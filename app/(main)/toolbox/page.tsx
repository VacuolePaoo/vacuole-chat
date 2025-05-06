"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { Plus, Globe } from "lucide-react"
import { createClientSupabaseClient } from "@/lib/supabase"
import { useUser } from "@/contexts/user-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { BookmarkCard } from "@/components/bookmark-card"

type Bookmark = {
  id: number
  title: string
  url: string
  creator_id: string
  created_at: string
  updated_at: string
  creator_name?: string
}

export default function ToolboxPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [formData, setFormData] = useState({ title: "", url: "" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { user } = useUser()
  const supabase = createClientSupabaseClient()

  // 加载所有书签
  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        const { data, error } = await supabase
          .from("bookmarks")
          .select(`
            *,
            users:creator_id (username)
          `)
          .order("created_at", { ascending: false })

        if (error) throw error

        // 格式化数据
        const formattedBookmarks = data.map((bookmark) => ({
          ...bookmark,
          creator_name: bookmark.users?.username || "未知用户",
        }))

        setBookmarks(formattedBookmarks)
      } catch (error) {
        console.error("Error fetching bookmarks:", error)
        toast({
          title: "加载失败",
          description: "无法加载百宝箱内容",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchBookmarks()

    // 设置实时订阅
    const channel = supabase
      .channel("bookmarks_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookmarks",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            // 获取创建者信息
            supabase
              .from("users")
              .select("username")
              .eq("id", payload.new.creator_id)
              .single()
              .then(({ data }) => {
                const newBookmark = {
                  ...payload.new,
                  creator_name: data?.username || "未知用户",
                } as Bookmark

                setBookmarks((current) => [newBookmark, ...current])
              })
              .catch((error) => {
                console.error("Error fetching creator info:", error)
                // 即使获取创建者信息失败，也添加书签
                const newBookmark = {
                  ...payload.new,
                  creator_name: "未知用户",
                } as Bookmark

                setBookmarks((current) => [newBookmark, ...current])
              })
          } else if (payload.eventType === "UPDATE") {
            setBookmarks((current) =>
              current.map((bookmark) => (bookmark.id === payload.new.id ? { ...bookmark, ...payload.new } : bookmark)),
            )
          } else if (payload.eventType === "DELETE") {
            setBookmarks((current) => current.filter((bookmark) => bookmark.id !== payload.old.id))
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // 处理表单变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // 添加新书签
  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // 验证输入
    if (!formData.title.trim() || !formData.url.trim()) {
      toast({
        title: "输入错误",
        description: "标题和URL不能为空",
        variant: "destructive",
      })
      return
    }

    // 验证URL格式
    let url = formData.url.trim()
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase.from("bookmarks").insert({
        title: formData.title.trim(),
        url: url,
        creator_id: user.id,
      })

      if (error) throw error

      // 重置表单
      setFormData({ title: "", url: "" })
      setIsAddDialogOpen(false)

      toast({
        title: "添加成功",
        description: "网址已成功添加到百宝箱",
      })
    } catch (error) {
      console.error("Error adding bookmark:", error)
      toast({
        title: "添加失败",
        description: "无法添加网址，请重试",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 处理书签删除
  const handleDeleteBookmark = async (id: number) => {
    try {
      const { error } = await supabase.from("bookmarks").delete().eq("id", id)

      if (error) throw error

      toast({
        title: "删除成功",
        description: "网址已从百宝箱中删除",
      })
    } catch (error) {
      console.error("Error deleting bookmark:", error)
      toast({
        title: "删除失败",
        description: "无法删除网址，请重试",
        variant: "destructive",
      })
    }
  }

  // 处理书签编辑
  const handleEditBookmark = async (id: number, data: { title: string; url: string }) => {
    try {
      // 验证URL格式
      let url = data.url.trim()
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url
      }

      const { error } = await supabase
        .from("bookmarks")
        .update({
          title: data.title.trim(),
          url: url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      if (error) throw error

      toast({
        title: "更新成功",
        description: "网址信息已更新",
      })
    } catch (error) {
      console.error("Error updating bookmark:", error)
      toast({
        title: "更新失败",
        description: "无法更新网址信息，请重试",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">百宝箱</h1>
          <p className="text-muted-foreground">收藏和分享有用的网址</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          添加网址
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">暂无收藏网址</h3>
          <p className="text-muted-foreground mb-4">点击"添加网址"按钮开始收藏有用的网站</p>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加网址
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {bookmarks.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              onDelete={handleDeleteBookmark}
              onEdit={handleEditBookmark}
            />
          ))}
        </div>
      )}

      {/* 添加网址对话框 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加网址</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddBookmark} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">网址标题</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="例如：Google"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">网址链接</Label>
              <Input
                id="url"
                name="url"
                value={formData.url}
                onChange={handleChange}
                placeholder="例如：https://www.google.com"
                required
              />
              <p className="text-xs text-muted-foreground">如果不包含 http:// 或 https://，将自动添加 https://</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "添加中..." : "添加"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
