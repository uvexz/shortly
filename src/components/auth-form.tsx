"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  createClientErrorReporter,
  getUserFacingErrorMessage,
} from "@/lib/client-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useMediaQuery } from "@/lib/use-media-query";
import { toast } from "sonner";
import { Mail, KeyRound, Loader2, CheckCircle2, ChevronRight } from "lucide-react";

const GithubIcon = (props: React.ComponentProps<"svg">) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

interface AuthFormProps {
  mode: "login" | "register";
  enableEmail: boolean;
  enableGithub: boolean;
  callbackUrl?: string;
}

type Step = "email" | "otp" | "add-passkey";

const authFormReporter = createClientErrorReporter("auth_form");

export function AuthForm({
  mode,
  enableEmail,
  enableGithub,
  callbackUrl = "/",
}: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const supportsPasskey =
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined";

  function finish() {
    router.push(callbackUrl);
    router.refresh();
  }

  async function handleSendOtp() {
    if (!email) return;
    setLoading(true);
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });
      if (res.error) {
        authFormReporter.warn("send_otp_failed_response", { mode, email });
        toast.error(getUserFacingErrorMessage(res.error, "发送验证码失败"));
      } else {
        setStep("otp");
        toast.success("验证码已发送");
      }
    } catch (error) {
      authFormReporter.report("send_otp_failed_exception", error, {
        mode,
        email,
      });
      toast.error(getUserFacingErrorMessage(error, "发送验证码失败"));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp) return;
    setLoading(true);
    try {
      const res = await authClient.signIn.emailOtp({ email, otp });
      if (res.error) {
        authFormReporter.warn("verify_otp_failed_response", { mode, email });
        toast.error(getUserFacingErrorMessage(res.error, "验证码验证失败"));
      } else {
        if (mode === "register" && supportsPasskey) {
          setStep("add-passkey");
        } else {
          toast.success("登录成功");
          finish();
        }
      }
    } catch (error) {
      authFormReporter.report("verify_otp_failed_exception", error, {
        mode,
        email,
      });
      toast.error(getUserFacingErrorMessage(error, "验证码验证失败"));
    } finally {
      setLoading(false);
    }
  }

  async function handleGithub() {
    setLoading(true);
    try {
      const res = await authClient.signIn.social({
        provider: "github",
        callbackURL: callbackUrl,
      });
      if (res?.error) {
        authFormReporter.warn("sign_in_github_failed_response", { mode });
        toast.error(getUserFacingErrorMessage(res.error, "GitHub 登录失败"));
      }
    } catch (error) {
      authFormReporter.report("sign_in_github_failed_exception", error, {
        mode,
      });
      toast.error(getUserFacingErrorMessage(error, "GitHub 登录失败"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignInPasskey() {
    setLoading(true);
    try {
      const res = await authClient.signIn.passkey();
      if (res?.error) {
        authFormReporter.warn("sign_in_passkey_failed_response", { mode });
        toast.error(getUserFacingErrorMessage(res.error, "Passkey 登录失败"));
      } else {
        toast.success("登录成功");
        finish();
      }
    } catch (error) {
      authFormReporter.report("sign_in_passkey_failed_exception", error, {
        mode,
      });
      toast.error(getUserFacingErrorMessage(error, "Passkey 登录失败"));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPasskey() {
    setLoading(true);
    try {
      const res = await authClient.passkey.addPasskey();
      if (res?.error) {
        authFormReporter.warn("add_passkey_failed_response", { mode, email });
        toast.error(getUserFacingErrorMessage(res.error, "无法保存 Passkey"));
      } else {
        toast.success("Passkey 已保存 — 您现在可以使用它立即登录");
      }
    } catch (error) {
      authFormReporter.report("add_passkey_failed_exception", error, {
        mode,
        email,
      });
      toast.error(getUserFacingErrorMessage(error, "无法保存 Passkey"));
    } finally {
      setLoading(false);
      finish();
    }
  }

  if (step === "add-passkey") {
    return (
      <div className="flex animate-in fade-in slide-in-from-bottom-4 duration-500 flex-col items-center gap-6 py-4 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/5 text-primary ring-8 ring-primary/5">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <p className="text-xl font-extrabold tracking-tight">账户创建成功</p>
            <p className="max-w-xs text-sm font-medium text-muted-foreground">
              保存 Passkey，以便下次无需验证码即可立即登录。
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Button
            onClick={handleAddPasskey}
            disabled={loading}
            className="h-12 w-full rounded-xl text-base font-bold shadow-lg shadow-primary/10 transition-[box-shadow,transform] hover:-translate-y-1 hover:shadow-xl"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-5 w-5" />
            )}
            保存 Passkey
          </Button>
          <Button
            variant="ghost"
            onClick={finish}
            disabled={loading}
            className="h-12 w-full rounded-xl font-semibold text-muted-foreground hover:text-foreground"
          >
            跳过并进入后台
          </Button>
        </div>
      </div>
    );
  }

  const hasProviders = enableEmail || enableGithub;

  return (
    <div className="flex animate-in fade-in slide-in-from-bottom-4 duration-500 flex-col gap-6">
      {enableEmail && (
        <>
          {step === "email" ? (
            <div className="flex flex-col gap-3">
              <div className="space-y-2">
                <Label htmlFor="auth-email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                  电子邮箱地址
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="auth-email"
                    name="email"
                    type="email"
                    placeholder="you@example.com…"
                    autoComplete="email"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    disabled={loading}
                    autoFocus={isDesktop}
                    className="h-12 rounded-xl border-border/60 bg-muted/40 pl-10 transition-[background-color,border-color,box-shadow] focus-visible:bg-background focus-visible:ring-4 focus-visible:ring-primary/5"
                  />
                </div>
              </div>
              <Button
                onClick={handleSendOtp}
                disabled={loading || !email}
                className="h-12 w-full rounded-xl text-base font-bold shadow-lg shadow-primary/10 transition-[box-shadow,transform] hover:-translate-y-1 hover:shadow-xl"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <ChevronRight className="mr-2 h-5 w-5" />
                )}
                {mode === "register" ? "继续创建账户" : "获取登录验证码"}
              </Button>
            </div>
          ) : (
            <div className="flex animate-in fade-in zoom-in-95 duration-500 flex-col gap-4">
              <div className="space-y-3">
                <Label htmlFor="auth-otp" className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                  请输入验证码
                </Label>
                <div className="rounded-lg border border-dashed border-primary/20 bg-primary/5 p-4 text-center">
                  <p className="text-sm font-medium text-muted-foreground mb-1">已发送至</p>
                  <p className="break-all font-bold text-primary">{email}</p>
                </div>
                <Input
                  id="auth-otp"
                  name="one-time-code"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456…"
                  autoComplete="one-time-code"
                  spellCheck={false}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                  disabled={loading}
                  maxLength={6}
                  autoFocus={isDesktop}
                  className="h-16 rounded-xl border-border/60 bg-background text-center text-3xl font-black tracking-[0.5em] transition-[border-color,box-shadow] focus-visible:ring-4 focus-visible:ring-primary/5"
                />
              </div>
              <Button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length < 6}
                className="h-12 w-full rounded-xl text-base font-bold shadow-lg shadow-primary/10 transition-[box-shadow,transform] hover:-translate-y-1 hover:shadow-xl"
              >
                {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                完成验证并登录
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep("email");
                  setOtp("");
                }}
                className="h-10 w-full rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                ← 邮箱填错了？返回修改
              </Button>
            </div>
          )}
        </>
      )}

      {hasProviders && step === "email" && (
        <div className="relative flex items-center py-2">
          <Separator className="flex-1" />
          <span className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
            或第三方登录
          </span>
          <Separator className="flex-1" />
        </div>
      )}

      {step === "email" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {enableGithub && (
            <Button
              variant="outline"
              onClick={handleGithub}
              disabled={loading}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-background font-bold transition-[background-color,transform] hover:-translate-y-1 hover:bg-accent"
            >
              <GithubIcon className="h-5 w-5" />
              <span>GitHub</span>
            </Button>
          )}

          {mode === "login" && (
            <Button
              variant="outline"
              onClick={handleSignInPasskey}
              disabled={loading}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-background font-bold transition-[background-color,transform] hover:-translate-y-1 hover:bg-accent"
            >
              <KeyRound className="h-5 w-5" />
              <span>Passkey</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
