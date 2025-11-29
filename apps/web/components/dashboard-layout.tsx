"use client"

import type React from "react"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  LayoutDashboard, 
  Package, 
  Settings, 
  Menu, 
  X, 
  Store,
  Bell,
  FileText,
  ChevronRight,
  LogOut,
  User,
  Building2
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface DashboardLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { 
    name: "Dashboard", 
    href: "/", 
    icon: LayoutDashboard,
    description: "Overview & quick stats"
  },
  { 
    name: "Alerts", 
    href: "/alerts", 
    icon: Bell,
    description: "Low stock items",
    highlight: true
  },
  { 
    name: "Inventory", 
    href: "/inventory", 
    icon: Package,
    description: "All products"
  },
  { 
    name: "Stores", 
    href: "/stores", 
    icon: Store,
    description: "Connected platforms"
  },
  { 
    name: "Requests", 
    href: "/requests", 
    icon: FileText,
    description: "Restock requests"
  },
  { 
    name: "Settings", 
    href: "/settings", 
    icon: Settings,
    description: "Preferences"
  },
]

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, profile, signOut, loading } = useAuth()

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // If not logged in, the auth provider will redirect
  if (!user) {
    return null
  }

  const userInitial = profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'
  const userName = profile?.full_name || user?.email || 'User'
  const orgName = profile?.organization?.name || 'No Organization'

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen w-72 border-r border-border bg-card transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-border">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <span className="text-white font-bold text-sm">R</span>
              </div>
              <div>
                <span className="font-bold text-foreground text-lg">RepOrder</span>
                <span className="text-xs text-muted-foreground block -mt-0.5">Connector</span>
              </div>
            </Link>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Organization badge */}
          {profile?.organization && (
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/50 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="truncate text-muted-foreground">{orgName}</span>
              </div>
            </div>
          )}

          {/* Navigation */}
          <ScrollArea className="flex-1 py-6">
            <nav className="space-y-1.5 px-4">
              {navigation.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== "/" && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      item.highlight && !isActive && "text-amber-500 hover:text-amber-400"
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className={cn(
                      "h-5 w-5 transition-transform group-hover:scale-110",
                      item.highlight && !isActive && "text-amber-500"
                    )} />
                    <div className="flex-1">
                      <span className="flex items-center gap-2">
                        {item.name}
                        {item.highlight && !isActive && (
                          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        )}
                      </span>
                      <span className={cn(
                        "text-xs block mt-0.5 transition-colors",
                        isActive ? "text-primary-foreground/70" : "text-muted-foreground/70"
                      )}>
                        {item.description}
                      </span>
                    </div>
                    <ChevronRight className={cn(
                      "h-4 w-4 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5",
                      isActive && "opacity-100"
                    )} />
                  </Link>
                )
              })}
            </nav>
          </ScrollArea>

          {/* User Menu */}
          <div className="border-t border-border p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors w-full text-left">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm uppercase">
                    {userInitial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{userName}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile?.role || 'Member'}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{userName}</span>
                    <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings/profile" className="cursor-pointer">
                    <User className="h-4 w-4 mr-2" />
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                {profile?.organization && (
                  <DropdownMenuItem disabled>
                    <Building2 className="h-4 w-4 mr-2" />
                    {orgName}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-red-500 focus:text-red-500 cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-72">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <span className="text-white font-bold text-xs">R</span>
            </div>
            <span className="font-semibold">RepOrder</span>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6 lg:p-8 max-w-7xl">{children}</main>
      </div>
    </div>
  )
}
