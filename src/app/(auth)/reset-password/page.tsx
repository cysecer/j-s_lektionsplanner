import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { parsePageInput } from "@/lib/server/params";
import { ResetPasswordForm } from "./reset-form";
import { resetTokenSchema } from "./token";

const searchSchema = z.object({ token: resetTokenSchema.optional().catch(undefined) });

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await parsePageInput(searchSchema, searchParams, {});
  if (!token) {
    const t = await getTranslations("auth.resetPassword");
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
          <CardDescription className="text-base">{t("invalid")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return <ResetPasswordForm token={token} />;
}
