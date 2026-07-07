import { auth } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings";
import { AuthForm } from "@/components/auth-form";
import { AuthPageShell } from "@/components/auth-page-shell";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function LoginPage() {
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
    <AuthPageShell mode="login" siteName={siteName}>
      <AuthForm
        mode="login"
        enableEmail={enableEmail}
        enableGithub={enableGithub}
        callbackUrl="/dashboard"
      />
    </AuthPageShell>
  );
}
