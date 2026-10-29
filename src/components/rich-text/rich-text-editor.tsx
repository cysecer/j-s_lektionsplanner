"use client";

import Bold from "@tiptap/extension-bold";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Italic from "@tiptap/extension-italic";
import { BulletList, ListItem } from "@tiptap/extension-list";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Placeholder, UndoRedo } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { Bold as BoldIcon, Italic as ItalicIcon, List } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { richTextSchema, type RichText } from "@/lib/rich-text/schema";
import { isRichTextEmpty } from "@/lib/rich-text/utils";
import { cn } from "@/lib/utils";

/**
 * Lightweight formatted text: paragraphs, bold, italic, bullet lists. Only
 * these extensions are loaded, so the editor cannot produce anything the
 * server would reject; the server validates again regardless.
 */
export function RichTextEditor({
  value,
  onChange,
  labelledBy,
  placeholder,
  invalid,
}: {
  value: RichText | null;
  onChange: (value: RichText | null) => void;
  labelledBy: string;
  placeholder?: string;
  invalid?: boolean;
}) {
  const t = useTranslations("richText");
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      HardBreak,
      BulletList,
      ListItem,
      UndoRedo,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value ?? undefined,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelledBy,
        class: "min-h-24 px-3 py-2 text-base outline-none [&_ul]:list-disc [&_ul]:pl-6 [&_p]:my-1",
      },
    },
    onUpdate: ({ editor: e }) => {
      const parsed = richTextSchema.safeParse(e.getJSON());
      onChange(parsed.success && !isRichTextEmpty(parsed.data) ? parsed.data : null);
    },
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      list: e?.isActive("bulletList") ?? false,
    }),
  });

  const tool = (
    active: boolean | undefined,
    label: string,
    icon: React.ReactNode,
    run: () => void,
  ) => (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      className="size-10"
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()} // keep the selection in the editor
      onClick={run}
    >
      {icon}
    </Button>
  );

  return (
    <div
      className={cn(
        "focus-within:ring-ring/50 focus-within:border-ring rounded-lg border focus-within:ring-3",
        invalid && "border-destructive",
      )}
    >
      <div role="toolbar" aria-label={t("toolbar")} className="flex gap-1 border-b p-1">
        {tool(state?.bold, t("bold"), <BoldIcon aria-hidden />, () =>
          editor?.chain().focus().toggleBold().run(),
        )}
        {tool(state?.italic, t("italic"), <ItalicIcon aria-hidden />, () =>
          editor?.chain().focus().toggleItalic().run(),
        )}
        {tool(state?.list, t("bulletList"), <List aria-hidden />, () =>
          editor?.chain().focus().toggleBulletList().run(),
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
