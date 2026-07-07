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
import { useMediaQuery } from "@/lib/use-media-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  KeyRound,
  Loader2,
  Mail,
} from "lucide-react";

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
        toast.success("Passkey 已保存，您现在可以使用它立即登录");
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

  const hasSecondaryProviders = enableGithub || mode === "login";
  const providerCount = (enableGithub ? 1 : 0) + (mode === "login" ? 1 : 0);
  const showProviderDivider =
    enableEmail && hasSecondaryProviders && step === "email";

  const inputClass =
    "auth-control-shadow h-10 rounded-md border-transparent bg-white px-3 text-sm text-[#171717] transition-[box-shadow,color] placeholder:text-[#8f8f8f] focus-visible:border-transparent focus-visible:ring-0";
  const primaryButtonClass =
    "auth-focus-ring h-10 w-full rounded-md bg-[#171717] text-sm font-medium text-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition-colors hover:bg-[#2f2f2f] focus-visible:ring-0 disabled:bg-[#171717]";
  const secondaryButtonClass =
    "auth-control-shadow h-10 rounded-md border-transparent bg-white text-sm font-medium text-[#171717] transition-colors hover:bg-[#f2f2f2] focus-visible:border-transparent focus-visible:ring-0";
  const ghostButtonClass =
    "auth-focus-ring h-9 rounded-md text-sm font-medium text-[#4d4d4d] transition-colors hover:bg-[#ebebeb] hover:text-[#171717] focus-visible:ring-0";

  if (step === "add-passkey") {
    return (
      <div className="flex flex-col items-center gap-6 py-2 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-white text-[#171717] auth-surface-shadow">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="space-y-2">
            <p className="text-xl font-semibold leading-7 text-[#171717]">
              账户创建成功
            </p>
            <p className="max-w-xs text-sm leading-6 text-[#4d4d4d]">
              保存 Passkey，以便下次无需验证码即可立即登录。
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Button
            onClick={handleAddPasskey}
            disabled={loading}
            className={primaryButtonClass}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            保存 Passkey
          </Button>
          <Button
            variant="ghost"
            onClick={finish}
            disabled={loading}
            className={ghostButtonClass}
          >
            跳过并进入后台
          </Button>
        </div>
      </div>
    );
  }

  if (!enableEmail && !hasSecondaryProviders) {
    return (
      <div className="rounded-md bg-[#fafafa] p-4 text-sm leading-6 text-[#4d4d4d] auth-border-shadow">
        当前没有启用可用的登录方式。请稍后再试，或联系站点管理员。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {enableEmail && (
        <>
          {step === "email" ? (
            <div className="flex flex-col gap-3">
              <div className="space-y-2">
                <Label
                  htmlFor="auth-email"
                  className="text-sm font-medium leading-5 text-[#171717]"
                >
                  电子邮箱地址
                </Label>
                <div className="group relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8f8f8f] transition-colors group-focus-within:text-[#0072f5]" />
                  <Input
                    id="auth-email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    disabled={loading}
                    autoFocus={isDesktop}
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>
              <Button
                onClick={handleSendOtp}
                disabled={loading || !email}
                className={primaryButtonClass}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
                {mode === "register" ? "继续创建账户" : "获取登录验证码"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="space-y-3">
                <Label
                  htmlFor="auth-otp"
                  className="text-sm font-medium leading-5 text-[#171717]"
                >
                  输入验证码
                </Label>
                <div className="rounded-md bg-[#fafafa] px-3 py-3 auth-border-shadow">
                  <div className="flex items-center gap-2 text-sm font-medium text-[#171717]">
                    <span className="size-2 rounded-full bg-[#0072f5]" />
                    验证码已发送
                  </div>
                  <p className="mt-1 break-all text-sm leading-6 text-[#4d4d4d]">
                    {email}
                  </p>
                </div>
                <Input
                  id="auth-otp"
                  name="one-time-code"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  autoComplete="one-time-code"
                  spellCheck={false}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                  disabled={loading}
                  maxLength={6}
                  autoFocus={isDesktop}
                  className={`${inputClass} h-12 text-center font-mono text-lg font-medium`}
                />
              </div>
              <Button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length < 6}
                className={primaryButtonClass}
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                完成验证并登录
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep("email");
                  setOtp("");
                }}
                className={ghostButtonClass}
              >
                <ArrowLeft className="size-4" />
                返回修改邮箱
              </Button>
            </div>
          )}
        </>
      )}

      {showProviderDivider && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1">
          <span className="h-px bg-[#ebebeb]" />
          <span className="text-xs text-[#8f8f8f]">或使用其他方式</span>
          <span className="h-px bg-[#ebebeb]" />
        </div>
      )}

      {step === "email" && hasSecondaryProviders && (
        <div
          className={
            providerCount > 1
              ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
              : "grid grid-cols-1 gap-3"
          }
        >
          {enableGithub && (
            <Button
              variant="outline"
              onClick={handleGithub}
              disabled={loading}
              className={secondaryButtonClass}
            >
              <GithubIcon className="size-4" />
              <span>GitHub</span>
            </Button>
          )}

          {mode === "login" && (
            <Button
              variant="outline"
              onClick={handleSignInPasskey}
              disabled={loading}
              className={secondaryButtonClass}
            >
              <KeyRound className="size-4" />
              <span>Passkey</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
