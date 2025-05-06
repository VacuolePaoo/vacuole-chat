import type React from "react"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { ProtectedRoute } from "@/components/protected-route"
import { PageLock } from "@/components/page-lock"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar className="hidden md:flex" />
        <div className="flex flex-col flex-1 overflow-hidden">
          <MobileNav className="md:hidden" />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
        <PageLock />
      </div>
    </ProtectedRoute>
  )
}
