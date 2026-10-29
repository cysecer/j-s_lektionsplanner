"use client";

import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/page-header";
import { FormDialog } from "@/components/form-dialog";
import { FormField } from "@/components/form-field";
import { MoveButtons, moveItem } from "@/components/move-buttons";
import { Button } from "@/components/ui/button";
import { firstFieldError } from "@/lib/i18n-keys";
import { useAction } from "@/lib/use-action";
import { useSyncedState } from "@/lib/use-synced-state";
import {
  createTeamAction,
  deleteTeamAction,
  reorderTeamsAction,
  restoreTeamAction,
  updateTeamAction,
} from "./actions";

type Team = {
  id: string;
  name: string;
  defaultStartTime: string;
  defaultDurationMinutes: string;
};

const blank: Omit<Team, "id"> = { name: "", defaultStartTime: "", defaultDurationMinutes: "" };

export function TeamsEditor({
  active,
  archived,
  clubDefaults,
}: {
  active: Team[];
  archived: Team[];
  clubDefaults: { time: string; duration: string };
}) {
  const t = useTranslations();
  const [order, setOrder] = useSyncedState(active);
  const reorder = useAction(reorderTeamsAction);
  const remove = useAction(deleteTeamAction);
  const restore = useAction(restoreTeamAction);

  function move(from: number, to: number) {
    const next = moveItem(order, from, to);
    setOrder(next);
    void reorder.run({ ids: next.map((x) => x.id) });
  }

  function summary(team: Team) {
    if (!team.defaultStartTime && !team.defaultDurationMinutes) {
      return t("settings.teams.clubDefaults");
    }
    return t("settings.teams.ownDefaults", {
      time: team.defaultStartTime || clubDefaults.time,
      duration: team.defaultDurationMinutes
        ? t("units.minutes", { count: Number(team.defaultDurationMinutes) })
        : clubDefaults.duration,
    });
  }

  return (
    <div className="grid gap-6">
      {order.length === 0 ? (
        <EmptyState title={t("settings.teams.empty")} />
      ) : (
        <ul className="divide-y rounded-lg border">
          {order.map((team, index) => (
            <li key={team.id} className="flex flex-wrap items-center gap-2 p-2 pl-4">
              <div className="min-w-40 flex-1">
                <p className="font-medium">{team.name}</p>
                <p className="text-muted-foreground text-sm">{summary(team)}</p>
              </div>
              <MoveButtons
                index={index}
                count={order.length}
                label={team.name}
                disabled={reorder.pending}
                onMove={move}
              />
              <TeamDialog
                mode="edit"
                team={team}
                clubDefaults={clubDefaults}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`${team.name}: ${t("common.edit")}`}
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
                    aria-label={`${team.name}: ${t("common.delete")}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                }
                description={t("settings.teams.deleteConfirm", { name: team.name })}
                confirmLabel={t("common.delete")}
                onConfirm={async () => {
                  const result = await remove.run({ id: team.id });
                  if (result) {
                    toast.success(
                      t(result.archived ? "settings.teams.archived" : "settings.teams.deleted", {
                        name: team.name,
                      }),
                    );
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <TeamDialog
        mode="create"
        team={{ id: "", ...blank }}
        clubDefaults={clubDefaults}
        trigger={
          <Button className="h-11 justify-self-start">
            <Plus aria-hidden />
            {t("settings.teams.add")}
          </Button>
        }
      />

      {archived.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="text-muted-foreground text-sm font-medium">
            {t("settings.teams.archivedTitle")}
          </h3>
          <ul className="divide-y rounded-lg border border-dashed">
            {archived.map((team) => (
              <li key={team.id} className="flex items-center justify-between gap-2 p-2 pl-4">
                <span className="text-muted-foreground">{team.name}</span>
                <Button
                  variant="ghost"
                  className="h-11"
                  disabled={restore.pending}
                  onClick={() => restore.run({ id: team.id })}
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

function TeamDialog({
  mode,
  team,
  clubDefaults,
  trigger,
}: {
  mode: "create" | "edit";
  team: Team;
  clubDefaults: { time: string; duration: string };
  trigger: React.ReactNode;
}) {
  const t = useTranslations();
  const [values, setValues] = useState(team);
  const create = useAction(createTeamAction);
  const update = useAction(updateTeamAction);
  const action = mode === "create" ? create : update;
  const error = (field: string) => firstFieldError(t, action.fieldErrors, field);

  return (
    <FormDialog
      trigger={trigger}
      title={mode === "create" ? t("settings.teams.add") : t("settings.teams.editTitle")}
      description={t("settings.teams.defaultsHint", clubDefaults)}
      pending={action.pending}
      onOpen={() => {
        setValues(team);
        action.clearErrors();
      }}
      onSubmit={async () => {
        const input = {
          name: values.name,
          defaultStartTime: values.defaultStartTime,
          defaultDurationMinutes: values.defaultDurationMinutes,
        };
        const result =
          mode === "create"
            ? await create.run(input, { success: t("common.saved") })
            : await update.run({ id: team.id, ...input }, { success: t("common.saved") });
        return result !== undefined;
      }}
    >
      <FormField
        label={t("settings.teams.name")}
        value={values.name}
        onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
        maxLength={60}
        required
        autoFocus
        error={error("name")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label={`${t("settings.teams.defaultStartTime")} (${t("common.optional")})`}
          type="time"
          step={300}
          value={values.defaultStartTime}
          onChange={(e) => setValues((v) => ({ ...v, defaultStartTime: e.target.value }))}
          error={error("defaultStartTime")}
        />
        <FormField
          label={`${t("settings.teams.defaultDuration")} (${t("common.optional")})`}
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          step={5}
          value={values.defaultDurationMinutes}
          onChange={(e) => setValues((v) => ({ ...v, defaultDurationMinutes: e.target.value }))}
          error={error("defaultDurationMinutes")}
        />
      </div>
    </FormDialog>
  );
}
