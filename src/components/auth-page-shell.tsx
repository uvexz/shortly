import type { ReactNode } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";

interface AuthPageShellProps {
  mode: "login" | "register";
  siteName: string;
  children: ReactNode;
}

const pageCopy = {
  login: {
    eyebrow: "账户访问",
    title: "欢迎回来",
    description: "继续进入你的 Shortly 工作区。",
    footerQuestion: "还没有账户？",
    footerAction: "创建账户",
    footerHref: "/register",
    secondaryHref: "https://github.com/uvexz/shortly/issues",
    secondaryLabel: "遇到问题？",
  },
  register: {
    eyebrow: "新账户设置",
    title: "创建账户",
    description: "用安全方式开启你的 Shortly 工作区。",
    footerQuestion: "已经有账户？",
    footerAction: "登录",
    footerHref: "/login",
    secondaryHref: "https://github.com/uvexz/shortly",
    secondaryLabel: "服务条款",
  },
};

export function AuthPageShell({
  mode,
  siteName,
  children,
}: AuthPageShellProps) {
  const copy = pageCopy[mode];

  return (
    <main className="min-h-svh bg-[#fafafa] text-[#171717]">
      <section className="flex min-h-svh items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[408px]">
          <Link
            href="/"
            className="auth-focus-ring mx-auto mb-8 inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm font-medium text-[#171717] transition-colors hover:text-[#4d4d4d]"
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-white auth-border-shadow">
              <Zap className="size-4" />
            </span>
            <span>{siteName}</span>
          </Link>

          <div className="rounded-xl bg-white p-6 auth-surface-shadow sm:p-8">
            <div className="mb-6 space-y-2">
              <p className="text-sm font-medium text-[#4d4d4d]">{copy.eyebrow}</p>
              <h1 className="text-2xl font-semibold leading-8 text-[#171717]">
                {copy.title}
              </h1>
              <p className="text-sm leading-6 text-[#4d4d4d]">
                {copy.description}
              </p>
            </div>

            {children}
          </div>

          {mode === "register" && (
            <p className="mt-4 px-1 text-xs leading-5 text-[#8f8f8f]">
              注册后可按提示保存 Passkey，以便下次快速登录。
            </p>
          )}

          <div className="mt-6 space-y-4 text-center">
            <p className="text-sm text-[#4d4d4d]">
              {copy.footerQuestion}{" "}
              <Link
                href={copy.footerHref}
                className="auth-focus-ring rounded-md text-[#0072f5] transition-colors hover:text-[#005fcc]"
              >
                {copy.footerAction}
              </Link>
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-[#8f8f8f]">
              <Link
                href="/"
                className="auth-focus-ring rounded-md px-1 py-1 transition-colors hover:text-[#171717]"
              >
                返回首页
              </Link>
              <span className="size-1 rounded-full bg-[#d4d4d4]" />
              <Link
                href={copy.secondaryHref}
                target="_blank"
                rel="noopener noreferrer"
                className="auth-focus-ring rounded-md px-1 py-1 transition-colors hover:text-[#171717]"
              >
                {copy.secondaryLabel}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
