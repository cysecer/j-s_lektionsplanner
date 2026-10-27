"use client";

import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errorMessage } from "@/lib/i18n-keys";
import { setActiveTeamAction } from "@/lib/preferences/actions";
import { cn } from "@/lib/utils";

const ALL = "all";

export function TeamSwitcher({
  teams,
  activeTeamId,
  className,
}: {
  teams: { id: string; name: string }[];
  activeTeamId: string | null;
  className?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const labelId = useId();

  if (teams.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span id={labelId} className="sr-only">
        {t("header.team")}
      </span>
      <Select
        value={activeTeamId ?? ALL}
        disabled={pending}
        onValueChange={(value) =>
          startTransition(async () => {
            const result = await setActiveTeamAction({ teamId: value === ALL ? null : value });
            if (!result.ok) toast.error(errorMessage(t, result.error));
            router.refresh();
          })
        }
      >
        <SelectTrigger
          aria-labelledby={labelId}
          title={t("header.teamHint")}
          size="lg"
          className="min-w-36"
        >
          <Users aria-hidden className="size-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("header.allTeams")}</SelectItem>
          {teams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
