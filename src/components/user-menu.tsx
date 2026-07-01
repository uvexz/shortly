"use client"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { ChevronsUpDown, LayoutDashboard, Shield, LogOut } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface UserMenuProps {
  user: {
    name: string
    email: string
    image?: string | null
    role?: string
  }
  layout?: "icon" | "panel"
  align?: "start" | "end"
  className?: string
}

export function UserMenu({ user, layout = "icon", align = "end", className }: UserMenuProps) {
  const router = useRouter()
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  async function handleSignOut() {
    await authClient.signOut()
    toast.success("已退出登录")
    router.push("/")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {layout === "panel" ? (
          <Button
            variant="ghost"
            aria-label="打开用户菜单"
            className={cn(
              "h-auto w-full justify-start gap-2 rounded-md px-2 py-2 text-left",
              "group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0",
              className
            )}
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={user.image ?? undefined} alt={user.name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="break-words text-sm font-medium">{user.name}</p>
              <p className="break-all text-xs text-muted-foreground">{user.email}</p>
            </div>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </Button>
        ) : (
          <Button variant="ghost" aria-label="打开用户菜单" className={cn("relative h-9 w-9 rounded-full p-0", className)}>
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.image ?? undefined} alt={user.name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel>
          <div className="flex min-w-0 flex-col">
            <span className="break-words font-medium">{user.name}</span>
            <span className="break-all text-xs text-muted-foreground">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            用户面板
          </Link>
        </DropdownMenuItem>
        {user.role === "admin" && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield className="mr-2 h-4 w-4" />
              管理面板
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
