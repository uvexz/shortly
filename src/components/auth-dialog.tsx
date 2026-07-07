"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AuthForm } from "@/components/auth-form"

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  enableEmail: boolean
  enableGithub: boolean
}

export function AuthDialog({ open, onOpenChange, enableEmail, enableGithub }: AuthDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,40rem)] w-[calc(100vw-2rem)] overflow-y-auto border-0 bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_2px_2px_rgba(0,0,0,0.04),0_8px_16px_-4px_rgba(0,0,0,0.04)] sm:max-w-[400px] sm:p-8">
        <DialogHeader className="gap-2 text-left">
          <DialogTitle className="break-words text-2xl font-semibold leading-8 text-[#171717]">
            登录至 Shortly
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-[#4d4d4d]">
            继续进入你的 Shortly 工作区。
          </DialogDescription>
        </DialogHeader>
        <AuthForm
          mode="login"
          enableEmail={enableEmail}
          enableGithub={enableGithub}
          callbackUrl="/"
        />
      </DialogContent>
    </Dialog>
  )
}
