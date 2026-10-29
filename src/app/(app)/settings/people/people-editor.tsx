"use client";

import { Copy, MailPlus, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormDialog } from "@/components/form-dialog";
import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TeamRole } from "@/generated/prisma/enums";
import { LANGUAGE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import type { AccessValue } from "@/lib/auth/team-access";
import { firstFieldError } from "@/lib/i18n-keys";
import { useAction } from "@/lib/use-action";
import {
  invitePersonAction,
  removeMemberAction,
  revokeInvitationAction,
  updateMemberAction,
} from "./actions";

type Member = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  access: AccessValue;
  coachId: string | null;
};
type Invitation = { id: string; email: string; access: AccessValue; expires: string };
type Coach = { id: string; name: string; linkedMembershipId: string | null };
type Team = { id: string; name: string };

/** The access select: three club-wide choices and "per team". */
type AccessChoice = "ADMIN" | "COACH" | "READER" | "TEAMS";
const CHOICES: AccessChoice[] = ["ADMIN", "COACH", "READER", "TEAMS"];
const NO_COACH = "none";
const NO_ACCESS = "";

const choiceOf = (access: AccessValue): AccessChoice =>
  access.kind === "admin" ? "ADMIN" : access.kind === "all" ? access.role : "TEAMS";

function accessFor(choice: Exclude<AccessChoice, "TEAMS">): AccessValue {
  return choice === "ADMIN" ? { kind: "admin" } : { kind: "all", role: choice };
}

/** "Leiter/-in: Kids · Nur lesen: Jugi" – what a per-team access means. */
function useAccessSummary(teams: Team[]) {
  const t = useTranslations();
  return (access: AccessValue) => {
    if (access.kind === "admin") return t("roles.ADMIN");
    if (access.kind === "all") {
      return t("settings.people.allTeams", { role: t(`roles.${access.role}`) });
    }
    if (access.teams.length === 0) return t("settings.people.noTeams");
    const names = (role: TeamRole) =>
      access.teams
        .filter((x) => x.role === role)
        .map((x) => teams.find((team) => team.id === x.teamId)?.name)
        .filter(Boolean)
        .join(", ");
    return (["COACH", "READER"] as const)
      .filter((role) => names(role))
      .map((role) => `${t(`roles.${role}`)}: ${names(role)}`)
      .join(" · ");
  };
}

export function PeopleEditor(props: {
  viewerUserId: string;
  viewerLocale: Locale;
  members: Member[];
  invitations: Invitation[];
  coaches: Coach[];
  teams: Team[];
}) {
  const t = useTranslations();
  const revoke = useAction(revokeInvitationAction);
  const summary = useAccessSummary(props.teams);

  return (
    <div className="grid gap-8">
      <InviteDialog
        coaches={props.coaches}
        teams={props.teams}
        defaultLocale={props.viewerLocale}
      />

      <section className="grid gap-3" aria-labelledby="members-heading">
        <h3 id="members-heading" className="font-medium">
          {t("settings.people.members")}
        </h3>
        <ul className="divide-y rounded-lg border">
          {props.members.map((member) => (
            <MemberRow
              key={member.membershipId}
              member={member}
              coaches={props.coaches}
              teams={props.teams}
              isSelf={member.userId === props.viewerUserId}
            />
          ))}
        </ul>
      </section>

      <section className="grid gap-3" aria-labelledby="pending-heading">
        <h3 id="pending-heading" className="font-medium">
          {t("settings.people.pending")}
        </h3>
        {props.invitations.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("settings.people.noPending")}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {props.invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center gap-2 p-2 pl-4">
                <div className="min-w-48 flex-1">
                  <p className="font-medium break-all">{invitation.email}</p>
                  <p className="text-muted-foreground text-sm">
                    {summary(invitation.access)} ·{" "}
                    {t("settings.people.expires", { date: invitation.expires })}
                  </p>
                </div>
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" className="h-11">
                      {t("settings.people.revoke")}
                    </Button>
                  }
                  description={t("settings.people.revokeConfirm", { email: invitation.email })}
                  confirmLabel={t("settings.people.revoke")}
                  onConfirm={async () => {
                    await revoke.run({ invitationId: invitation.id });
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AccessSelect({
  value,
  onChange,
  labelledBy,
  disabled,
}: {
  value: AccessChoice;
  onChange: (choice: AccessChoice) => void;
  labelledBy: string;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const label = (choice: AccessChoice) =>
    choice === "TEAMS" ? t("settings.people.perTeam") : t(`roles.${choice}`);
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AccessChoice)} disabled={disabled}>
      <SelectTrigger size="lg" aria-labelledby={labelledBy} className="w-full">
        {/* Only the name in the closed field; the list shows the descriptions. */}
        <SelectValue>{label(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {CHOICES.map((choice) => (
          <SelectItem key={choice} value={choice}>
            <span className="grid text-left">
              <span>{label(choice)}</span>
              <span className="text-muted-foreground text-xs">
                {t(`settings.people.roleHints.${choice}`)}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** One row per team: no access, coach or reader. */
function TeamRolesEditor({
  teams,
  value,
  onChange,
  error,
}: {
  teams: Team[];
  value: { teamId: string; role: TeamRole }[];
  onChange: (value: { teamId: string; role: TeamRole }[]) => void;
  error?: string;
}) {
  const t = useTranslations();
  const roleOf = (teamId: string) => value.find((x) => x.teamId === teamId)?.role ?? NO_ACCESS;
  const set = (teamId: string, role: string) =>
    onChange([
      ...value.filter((x) => x.teamId !== teamId),
      ...(role === NO_ACCESS ? [] : [{ teamId, role: role as TeamRole }]),
    ]);
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{t("settings.people.teamRoles")}</legend>
      {teams.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("settings.people.noTeamsInClub")}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {teams.map((team) => (
            <li key={team.id} className="flex items-center justify-between gap-3 py-1 pr-1 pl-3">
              <label htmlFor={`team-role-${team.id}`} className="text-sm">
                {team.name}
              </label>
              <select
                id={`team-role-${team.id}`}
                value={roleOf(team.id)}
                onChange={(e) => set(team.id, e.target.value)}
                className="border-input bg-background focus-visible:ring-ring/50 h-11 w-44 rounded-lg border px-2.5 text-base outline-none focus-visible:ring-3 md:text-sm"
              >
                <option value={NO_ACCESS}>{t("settings.people.noAccess")}</option>
                <option value="COACH">{t("roles.COACH")}</option>
                <option value="READER">{t("roles.READER")}</option>
              </select>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">{t("settings.people.teamRolesHint")}</p>
      )}
    </fieldset>
  );
}

function CoachSelect({
  value,
  onChange,
  coaches,
  labelledBy,
  ownMembershipId,
}: {
  value: string | null;
  onChange: (coachId: string | null) => void;
  coaches: Coach[];
  labelledBy: string;
  ownMembershipId?: string;
}) {
  const t = useTranslations();
  // Coaches already linked to someone else are not offered.
  const available = coaches.filter(
    (c) => !c.linkedMembershipId || c.linkedMembershipId === ownMembershipId,
  );
  return (
    <Select value={value ?? NO_COACH} onValueChange={(v) => onChange(v === NO_COACH ? null : v)}>
      <SelectTrigger size="lg" aria-labelledby={labelledBy} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_COACH}>{t("settings.people.noCoach")}</SelectItem>
        {available.map((coach) => (
          <SelectItem key={coach.id} value={coach.id}>
            {coach.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MemberRow({
  member,
  coaches,
  teams,
  isSelf,
}: {
  member: Member;
  coaches: Coach[];
  teams: Team[];
  isSelf: boolean;
}) {
  const t = useTranslations();
  const roleLabel = useId();
  const coachLabel = useId();
  const update = useAction(updateMemberAction);
  const remove = useAction(removeMemberAction);
  const summary = useAccessSummary(teams);
  const [editingTeams, setEditingTeams] = useState(false);
  const [draft, setDraft] = useState<{ teamId: string; role: TeamRole }[]>([]);

  const save = (patch: { access?: AccessValue; coachId?: string | null }) =>
    update.run(
      {
        membershipId: member.membershipId,
        access: patch.access ?? member.access,
        coachId: patch.coachId === undefined ? member.coachId : patch.coachId,
      },
      { success: t("common.saved"), labels: { "access.teams": t("settings.people.teamRoles") } },
    );

  function openTeams() {
    setDraft(member.access.kind === "teams" ? member.access.teams : []);
    update.clearErrors();
    setEditingTeams(true);
  }

  return (
    <li className="grid gap-3 p-3 sm:grid-cols-[1fr_12rem_12rem_auto] sm:items-end">
      <div className="grid gap-0.5">
        <p className="font-medium">
          {member.name}
          {isSelf ? (
            <Badge variant="secondary" className="ml-2 align-middle">
              {t("settings.people.you")}
            </Badge>
          ) : null}
        </p>
        <p className="text-muted-foreground text-sm break-all">{member.email}</p>
        <p className="text-sm">
          {summary(member.access)}
          {member.access.kind === "teams" ? (
            <Button
              variant="link"
              className="ml-1 h-auto p-0 align-baseline"
              onClick={openTeams}
              aria-label={`${member.name}: ${t("settings.people.editTeams")}`}
            >
              <Pencil aria-hidden className="size-3.5" />
              {t("settings.people.editTeams")}
            </Button>
          ) : null}
        </p>
      </div>
      <div className="grid gap-1">
        <Label id={roleLabel} className="text-xs">
          {t("settings.people.role")}
        </Label>
        <AccessSelect
          value={choiceOf(member.access)}
          labelledBy={roleLabel}
          disabled={update.pending}
          onChange={(choice) =>
            choice === "TEAMS" ? openTeams() : void save({ access: accessFor(choice) })
          }
        />
      </div>
      <div className="grid gap-1">
        <Label id={coachLabel} className="text-xs">
          {t("settings.people.coach")}
        </Label>
        <CoachSelect
          value={member.coachId}
          coaches={coaches}
          labelledBy={coachLabel}
          ownMembershipId={member.membershipId}
          onChange={(coachId) => void save({ coachId })}
        />
      </div>
      {isSelf ? (
        <span className="hidden size-11 sm:block" aria-hidden />
      ) : (
        <ConfirmDialog
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label={`${member.name}: ${t("settings.people.remove")}`}
            >
              <Trash2 aria-hidden />
            </Button>
          }
          description={t("settings.people.removeConfirm", { name: member.name })}
          confirmLabel={t("settings.people.remove")}
          onConfirm={async () => {
            await remove.run({ membershipId: member.membershipId });
          }}
        />
      )}

      <Dialog open={editingTeams} onOpenChange={setEditingTeams}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <form
            noValidate
            className="grid gap-5"
            onSubmit={async (event) => {
              event.preventDefault();
              const saved = await save({ access: { kind: "teams", teams: draft } });
              if (saved !== undefined) setEditingTeams(false);
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("settings.people.teamsTitle", { name: member.name })}</DialogTitle>
              <DialogDescription>{t("settings.people.teamsIntro")}</DialogDescription>
            </DialogHeader>
            <TeamRolesEditor
              teams={teams}
              value={draft}
              onChange={setDraft}
              error={firstFieldError(t, update.fieldErrors, "access.teams")}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setEditingTeams(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" className="h-11" disabled={update.pending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function InviteDialog({
  coaches,
  teams,
  defaultLocale,
}: {
  coaches: Coach[];
  teams: Team[];
  defaultLocale: Locale;
}) {
  const t = useTranslations();
  const roleLabel = useId();
  const coachLabel = useId();
  const localeLabel = useId();
  const initial = {
    email: "",
    choice: "COACH" as AccessChoice,
    teams: [] as { teamId: string; role: TeamRole }[],
    coachId: null as string | null,
    locale: defaultLocale,
  };
  const [values, setValues] = useState(initial);
  const [link, setLink] = useState<string>();
  const invite = useAction(invitePersonAction);

  return (
    <div className="grid gap-3">
      <FormDialog
        trigger={
          <Button className="h-11 justify-self-start">
            <MailPlus aria-hidden />
            {t("settings.people.invite")}
          </Button>
        }
        title={t("settings.people.inviteTitle")}
        description={t("settings.people.inviteIntro")}
        submitLabel={t("settings.people.send")}
        pending={invite.pending}
        onOpen={() => {
          setValues(initial);
          invite.clearErrors();
        }}
        onSubmit={async () => {
          const result = await invite.run(
            {
              email: values.email,
              access:
                values.choice === "TEAMS"
                  ? { kind: "teams", teams: values.teams }
                  : accessFor(values.choice),
              coachId: values.coachId,
              locale: values.locale,
            },
            {
              success: t("settings.people.invited", { email: values.email.trim() }),
              labels: {
                email: t("settings.people.email"),
                "access.teams": t("settings.people.teamRoles"),
              },
            },
          );
          if (result) setLink(result.url);
          return result !== undefined;
        }}
      >
        <FormField
          label={t("settings.people.email")}
          type="email"
          inputMode="email"
          autoComplete="off"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          required
          autoFocus
          error={firstFieldError(t, invite.fieldErrors, "email")}
        />
        <div className="grid gap-2">
          <Label id={roleLabel}>{t("settings.people.role")}</Label>
          <AccessSelect
            value={values.choice}
            labelledBy={roleLabel}
            onChange={(choice) => setValues((v) => ({ ...v, choice }))}
          />
          <p className="text-muted-foreground text-sm">
            {t(`settings.people.roleHints.${values.choice}`)}
          </p>
        </div>
        {values.choice === "TEAMS" ? (
          <TeamRolesEditor
            teams={teams}
            value={values.teams}
            onChange={(teamRoles) => setValues((v) => ({ ...v, teams: teamRoles }))}
            error={firstFieldError(t, invite.fieldErrors, "access.teams")}
          />
        ) : null}
        <div className="grid gap-2">
          <Label id={coachLabel}>{t("settings.people.coach")}</Label>
          <CoachSelect
            value={values.coachId}
            coaches={coaches}
            labelledBy={coachLabel}
            onChange={(coachId) => setValues((v) => ({ ...v, coachId }))}
          />
          <p className="text-muted-foreground text-sm">{t("settings.people.coachHint")}</p>
        </div>
        <div className="grid gap-2">
          <Label id={localeLabel}>{t("settings.people.language")}</Label>
          <Select
            value={values.locale}
            onValueChange={(locale) => setValues((v) => ({ ...v, locale: locale as Locale }))}
          >
            <SelectTrigger size="lg" aria-labelledby={localeLabel} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem key={l} value={l} lang={l}>
                  {LANGUAGE_NAMES[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FormDialog>

      {link ? (
        <div className="bg-muted/50 grid gap-2 rounded-lg border p-3 text-sm" role="status">
          <p>{t("settings.people.linkHint")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all">{link}</code>
            <Button
              variant="outline"
              className="h-11"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                toast.success(t("common.copied"));
              }}
            >
              <Copy aria-hidden />
              {t("common.copy")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
