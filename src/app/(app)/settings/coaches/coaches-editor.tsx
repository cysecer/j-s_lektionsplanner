"use client";

import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormDialog } from "@/components/form-dialog";
import { FormField } from "@/components/form-field";
import { EmptyState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { firstFieldError } from "@/lib/i18n-keys";
import { useAction } from "@/lib/use-action";
import {
  createCoachAction,
  deleteCoachAction,
  restoreCoachAction,
  updateCoachAction,
} from "./actions";

type Team = { id: string; name: string };
type Coach = {
  id: string;
  name: string;
  archived: boolean;
  hasAccount: boolean;
  teamIds: string[];
};

export function CoachesEditor({ teams, coaches }: { teams: Team[]; coaches: Coach[] }) {
  const t = useTranslations();
  const remove = useAction(deleteCoachAction);
  const restore = useAction(restoreCoachAction);
  const teamName = new Map(teams.map((x) => [x.id, x.name]));
  const active = coaches.filter((c) => !c.archived);
  const archived = coaches.filter((c) => c.archived);

  return (
    <div className="grid gap-6">
      {active.length === 0 ? (
        <EmptyState title={t("settings.coaches.empty")} />
      ) : (
        <ul className="divide-y rounded-lg border">
          {active.map((coach) => (
            <li key={coach.id} className="flex flex-wrap items-center gap-2 p-2 pl-4">
              <div className="grid min-w-40 flex-1 gap-1">
                <p className="font-medium">
                  {coach.name}
                  {coach.hasAccount ? (
                    <Badge variant="secondary" className="ml-2 align-middle">
                      {t("settings.coaches.account")}
                    </Badge>
                  ) : null}
                </p>
                <p className="flex flex-wrap gap-1">
                  {coach.teamIds.length === 0 ? (
                    <span className="text-muted-foreground text-sm">
                      {t("settings.coaches.noTeams")}
                    </span>
                  ) : (
                    coach.teamIds.map((id) => (
                      <Badge key={id} variant="outline">
                        {teamName.get(id)}
                      </Badge>
                    ))
                  )}
                </p>
              </div>
              <CoachDialog
                mode="edit"
                coach={coach}
                teams={teams}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`${coach.name}: ${t("common.edit")}`}
                  >
                    <Pencil aria-hidden />
                  </Button>
                }
              />
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`${coach.name}: ${t("common.delete")}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                }
                description={t("settings.coaches.deleteConfirm", { name: coach.name })}
                confirmLabel={t("common.delete")}
                onConfirm={async () => {
                  const result = await remove.run({ id: coach.id });
                  if (result) {
                    toast.success(
                      t(
                        result.archived ? "settings.coaches.archived" : "settings.coaches.deleted",
                        {
                          name: coach.name,
                        },
                      ),
                    );
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <CoachDialog
        mode="create"
        coach={{ id: "", name: "", archived: false, hasAccount: false, teamIds: [] }}
        teams={teams}
        trigger={
          <Button className="h-11 justify-self-start">
            <Plus aria-hidden />
            {t("settings.coaches.add")}
          </Button>
        }
      />

      {archived.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="text-muted-foreground text-sm font-medium">
            {t("settings.coaches.archivedTitle")}
          </h3>
          <ul className="divide-y rounded-lg border border-dashed">
            {archived.map((coach) => (
              <li key={coach.id} className="flex items-center justify-between gap-2 p-2 pl-4">
                <span className="text-muted-foreground">{coach.name}</span>
                <Button
                  variant="ghost"
                  className="h-11"
                  disabled={restore.pending}
                  onClick={() => restore.run({ id: coach.id })}
                >
                  <RotateCcw aria-hidden />
                  {t("common.restore")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CoachDialog({
  mode,
  coach,
  teams,
  trigger,
}: {
  mode: "create" | "edit";
  coach: Coach;
  teams: Team[];
  trigger: ReactNode;
}) {
  const t = useTranslations();
  const groupId = useId();
  const [name, setName] = useState(coach.name);
  const [teamIds, setTeamIds] = useState(coach.teamIds);
  const create = useAction(createCoachAction);
  const update = useAction(updateCoachAction);
  const action = mode === "create" ? create : update;

  return (
    <FormDialog
      trigger={trigger}
      title={mode === "create" ? t("settings.coaches.add") : t("settings.coaches.editTitle")}
      pending={action.pending}
      onOpen={() => {
        setName(coach.name);
        setTeamIds(coach.teamIds);
        action.clearErrors();
      }}
      onSubmit={async () => {
        const result =
          mode === "create"
            ? await create.run({ name, teamIds }, { success: t("common.saved") })
            : await update.run({ id: coach.id, name, teamIds }, { success: t("common.saved") });
        return result !== undefined;
      }}
    >
      <FormField
        label={t("settings.coaches.name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        required
        autoFocus
        autoComplete="off"
        error={firstFieldError(t, action.fieldErrors, "name")}
      />
      {teams.length > 0 ? (
        <fieldset className="grid gap-2" aria-labelledby={groupId}>
          <legend id={groupId} className="mb-1 text-sm font-medium">
            {t("settings.coaches.teams")}
          </legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {teams.map((team) => {
              const checked = teamIds.includes(team.id);
              return (
                <Label
                  key={team.id}
                  className="hover:bg-accent flex min-h-11 items-center gap-3 rounded-md px-2 font-normal"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) =>
                      setTeamIds((ids) =>
                        value === true ? [...ids, team.id] : ids.filter((id) => id !== team.id),
                      )
                    }
                  />
                  {team.name}
                </Label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </FormDialog>
  );
}
