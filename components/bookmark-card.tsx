"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ExternalLink, User, Edit, Trash, Copy, Check } from "lucide-react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

type Bookmark = {
  id: number
  title: string
  url: string
  creator_id: string
  created_at: string
  updated_at: string
  creator_name?: string
}

interface BookmarkCardProps {
  bookmark: Bookmark
  onDelete: (id: number) => Promise<void>
  onEdit: (id: number, data: { title: string; url: string }) => Promise<void>
}

export function BookmarkCard({ bookmark, onDelete, onEdit }: BookmarkCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [formData, setFormData] = useState({ title: bookmark.title, url: bookmark.url })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false)

  // 处理表单变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // 处理编辑提交
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await onEdit(bookmark.id, formData)
      setIsEditDialogOpen(false)
    } catch (error) {
      console.error("Error in edit submit:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 处理删除确认
  const handleDeleteConfirm = async () => {
    setIsSubmitting(true)

    try {
      await onDelete(bookmark.id)
      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error("Error in delete confirm:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 复制链接到剪贴板
  const copyToClipboard = () => {
    navigator.clipboard.writeText(bookmark.url)
    setCopied(true)

    toast({
      title: "已复制",
      description: "链接已复制到剪贴板",
    })

    setTimeout(() => setCopied(false), 2000)
  }

  // 格式化时间
  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: zhCN })
    } catch (error) {
      return "未知时间"
    }
  }

  // 获取网站图标
  const getFaviconUrl = (url: string) => {
    try {
      const urlObj = new URL(url)
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`
    } catch (error) {
      return `https://www.google.com/s2/favicons?domain=example.com&sz=64`
    }
  }

  // 处理对话框关闭后的事件
  useEffect(() => {
    const handleDialogClose = () => {
      // 确保对话框关闭后，上下文菜单状态也被重置
      setIsContextMenuOpen(false)
    }

    if (!isEditDialogOpen && !isDeleteDialogOpen) {
      handleDialogClose()
    }
  }, [isEditDialogOpen, isDeleteDialogOpen])

  return (
    <>
      <ContextMenu onOpenChange={setIsContextMenuOpen}>
        <ContextMenuTrigger>
          <Card className={`overflow-hidden hover:shadow-md transition-shadow ${isContextMenuOpen ? "z-50" : ""}`}>
            <CardContent className="p-0">
              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 hover:bg-muted/50 transition-colors"
                onClick={(e) => {
                  if (isContextMenuOpen) {
                    e.preventDefault()
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                    <img
                      src={getFaviconUrl(bookmark.url) || "/placeholder.svg"}
                      alt={bookmark.title}
                      className="h-6 w-6 object-contain"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=24&width=24"
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate mb-1">{bookmark.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">{bookmark.url}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </a>
            </CardContent>
            <CardFooter className="p-3 pt-0 border-t flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center">
                <User className="h-3 w-3 mr-1" />
                <span>{bookmark.creator_name}</span>
              </div>
              <div>{formatTime(bookmark.created_at)}</div>
            </CardFooter>
          </Card>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => window.open(bookmark.url, "_blank")}>
            <ExternalLink className="h-4 w-4 mr-2" />
            打开链接
          </ContextMenuItem>
          <ContextMenuItem onClick={copyToClipboard}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            复制链接
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => setIsEditDialogOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            编辑
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash className="h-4 w-4 mr-2" />
            删除
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* 编辑对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑网址</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">网址标题</Label>
              <Input
                id="edit-title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="例如：Google"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-url">网址链接</Label>
              <Input
                id="edit-url"
                name="url"
                value={formData.url}
                onChange={handleChange}
                placeholder="例如：https://www.google.com"
                required
              />
              <p className="text-xs text-muted-foreground">如果不包含 http:// 或 https://，将自动添加 https://</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p>您确定要删除 "{bookmark.title}" 吗？此操作无法撤销。</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteConfirm} disabled={isSubmitting}>
              {isSubmitting ? "删除中..." : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
