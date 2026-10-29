"use client";

import { Copy, MailPlus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormDialog } from "@/components/form-dialog";
import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Role } from "@/generated/prisma/enums";
import { LANGUAGE_NAMES, LOCALES, type Locale } from "@/i18n/config";
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
  role: Role;
  coachId: string | null;
};
type Invitation = { id: string; email: string; role: Role; expires: string };
type Coach = { id: string; name: string; linkedMembershipId: string | null };

const ROLES = Object.values(Role);
const NO_COACH = "none";

export function PeopleEditor(props: {
  viewerUserId: string;
  viewerLocale: Locale;
  members: Member[];
  invitations: Invitation[];
  coaches: Coach[];
}) {
  const t = useTranslations();
  const revoke = useAction(revokeInvitationAction);

  return (
    <div className="grid gap-8">
      <InviteDialog coaches={props.coaches} defaultLocale={props.viewerLocale} />

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
                    {t(`roles.${invitation.role}`)} ·{" "}
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

function RoleSelect({
  value,
  onChange,
  labelledBy,
  disabled,
}: {
  value: Role;
  onChange: (role: Role) => void;
  labelledBy: string;
  disabled?: boolean;
}) {
  const t = useTranslations();
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Role)} disabled={disabled}>
      <SelectTrigger size="lg" aria-labelledby={labelledBy} className="w-full">
        {/* Only the role name in the closed field; the list shows the descriptions. */}
        <SelectValue>{t(`roles.${value}`)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            <span className="grid text-left">
              <span>{t(`roles.${role}`)}</span>
              <span className="text-muted-foreground text-xs">
                {t(`settings.people.roleHints.${role}`)}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  isSelf,
}: {
  member: Member;
  coaches: Coach[];
  isSelf: boolean;
}) {
  const t = useTranslations();
  const roleLabel = useId();
  const coachLabel = useId();
  const update = useAction(updateMemberAction);
  const remove = useAction(removeMemberAction);

  const save = (patch: Partial<Pick<Member, "role" | "coachId">>) =>
    update.run(
      {
        membershipId: member.membershipId,
        role: patch.role ?? member.role,
        coachId: patch.coachId === undefined ? member.coachId : patch.coachId,
      },
      { success: t("common.saved") },
    );

  return (
    <li className="grid gap-3 p-3 sm:grid-cols-[1fr_12rem_12rem_auto] sm:items-end">
      <div>
        <p className="font-medium">
          {member.name}
          {isSelf ? (
            <Badge variant="secondary" className="ml-2 align-middle">
              {t("settings.people.you")}
            </Badge>
          ) : null}
        </p>
        <p className="text-muted-foreground text-sm break-all">{member.email}</p>
      </div>
      <div className="grid gap-1">
        <Label id={roleLabel} className="text-xs">
          {t("settings.people.role")}
        </Label>
        <RoleSelect
          value={member.role}
          labelledBy={roleLabel}
          disabled={update.pending}
          onChange={(role) => void save({ role })}
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
    </li>
  );
}

function InviteDialog({ coaches, defaultLocale }: { coaches: Coach[]; defaultLocale: Locale }) {
  const t = useTranslations();
  const roleLabel = useId();
  const coachLabel = useId();
  const localeLabel = useId();
  const initial = {
    email: "",
    role: "COACH" as Role,
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
          const result = await invite.run(values, {
            success: t("settings.people.invited", { email: values.email.trim() }),
          });
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
          <RoleSelect
            value={values.role}
            labelledBy={roleLabel}
            onChange={(role) => setValues((v) => ({ ...v, role }))}
          />
          <p className="text-muted-foreground text-sm">
            {t(`settings.people.roleHints.${values.role}`)}
          </p>
        </div>
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
