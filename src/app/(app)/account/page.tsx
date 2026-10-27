import { getFormatter, getTranslations } from "next-intl/server";
import { PasskeySetupButton } from "@/components/auth/passkey-setup-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PasswordForm } from "./password-form";
import { RemovePasskeyButton } from "./remove-passkey-button";
import { SignOutEverywhereButton } from "./sign-out-everywhere-button";

export default async function AccountPage() {
  const viewer = await requireViewer();
  const t = await getTranslations();
  const format = await getFormatter();
  const [passkeys, credential] = await Promise.all([
    db.passkey.findMany({
      where: { userId: viewer.userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, createdAt: true },
    }),
    db.account.findFirst({
      where: { userId: viewer.userId, providerId: "credential", password: { not: null } },
      select: { id: true },
    }),
  ]);

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t("auth.account.title")}</h1>
        <p className="text-muted-foreground">
          {viewer.name} · {viewer.email} · {t(`roles.${viewer.role}`)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("auth.account.passkeys")}</CardTitle>
          <CardDescription>{t("auth.account.passkeysIntro")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {passkeys.length === 0 ? (
            <p className="text-muted-foreground">{t("auth.account.noPasskeys")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {passkeys.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 p-3">
                  <div>
                    <p className="font-medium">{p.name || t("auth.account.unnamedPasskey")}</p>
                    <p className="text-muted-foreground text-sm">
                      {t("auth.account.passkeyCreated", {
                        date: format.dateTime(p.createdAt, { dateStyle: "medium" }),
                      })}
                    </p>
                  </div>
                  <RemovePasskeyButton id={p.id} />
                </li>
              ))}
            </ul>
          )}
          <PasskeySetupButton className="h-11 w-full sm:w-auto" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("auth.account.password")}</CardTitle>
          <CardDescription>{t("auth.account.passwordIntro")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm">
            {credential ? t("auth.account.passwordSet") : t("auth.account.noPassword")}
          </p>
          <PasswordForm hasPassword={Boolean(credential)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("auth.account.sessions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <SignOutEverywhereButton />
        </CardContent>
      </Card>
    </div>
  );
}
