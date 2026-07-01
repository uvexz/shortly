import { auth } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings";
import { AuthForm } from "@/components/auth-form";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Zap } from "lucide-react";
import Image from "next/image";

export default async function RegisterPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (session) redirect("/dashboard");

  const settings = await getSiteSettings();
  const siteName = settings?.siteName?.trim() || "Shortly";
  const enableEmail = !!process.env.RESEND_API_KEY;
  const enableGithub = !!(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
  );

  return (
    <main className="flex min-h-svh bg-background">
      {/* Brand Visual Side */}
      <section className="relative hidden w-1/2 overflow-hidden lg:block">
        <Image
          src="/auth-visual.png"
          alt="Shortly Brand Visual"
          fill
          className="object-cover transition-transform duration-[20s] hover:scale-110"
          priority
        />
        <div className="absolute inset-0 bg-black/5" />
        <div className="absolute inset-0 flex flex-col justify-between p-12 text-white/90">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tighter mix-blend-difference">
            <Zap className="h-6 w-6 fill-current" />
            <span>{siteName}</span>
          </Link>
          <div className="max-w-md space-y-4 mix-blend-difference opacity-80">
            <p className="text-4xl font-extrabold leading-none tracking-tight">
              Privacy First. <br /> Control Always.
            </p>
            <p className="text-sm font-medium">
              Create your account in seconds and start managing your digital presence with absolute ease and security.
            </p>
          </div>
        </div>
      </section>

      {/* Form Side */}
      <section className="flex w-full items-center justify-center px-[var(--page-gutter)] py-8 lg:w-1/2 lg:px-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-primary/10 lg:hidden">
              <Zap className="h-6 w-6 fill-current" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight">创建新账户</h1>
              <p className="text-sm font-medium text-muted-foreground">
                开启您的效率之旅 — 请填入您的注册信息
              </p>
            </div>
          </div>

          <AuthForm
            mode="register"
            enableEmail={enableEmail}
            enableGithub={enableGithub}
            callbackUrl="/dashboard"
          />

          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground/60 italic">
            * 注册后可按提示保存 Passkey，以便后续快速登录。我们尊重您的隐私，绝不主动发送垃圾邮件。
          </p>

          <div className="space-y-4 pt-4 border-t">
            <p className="text-center text-sm text-muted-foreground">
              已经有账户了？{" "}
              <Link
                href="/login"
                className="font-bold text-foreground underline-offset-4 transition-colors hover:underline"
              >
                立即登录
              </Link>
            </p>
            <div className="flex items-center justify-center gap-4 pt-2">
              <Link href="/" className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
                返回首页
              </Link>
              <div className="h-1 w-1 rounded-full bg-border" />
              <Link
                href="https://github.com/uvexz/shortly"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                服务条款
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
