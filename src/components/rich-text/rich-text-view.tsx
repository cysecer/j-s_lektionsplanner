import { Fragment } from "react";
import type { RichText, RichTextBlock, RichTextInline } from "@/lib/rich-text/schema";
import { cn } from "@/lib/utils";

/**
 * Renders the restricted rich-text JSON as React elements. No HTML string is
 * ever produced or injected, so stored text cannot carry markup or scripts.
 */
export function RichTextView({ value, className }: { value: RichText | null; className?: string }) {
  if (!value || value.content.length === 0) return null;
  return (
    <div className={cn("grid gap-1 [&_ul]:list-disc [&_ul]:pl-5", className)}>
      {value.content.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: RichTextBlock }) {
  if (block.type === "paragraph") {
    return (
      <p>
        <Inline nodes={block.content ?? []} />
      </p>
    );
  }
  return (
    <ul>
      {block.content.map((item, i) => (
        <li key={i}>
          {item.content.map((p, j) => (
            <p key={j}>
              <Inline nodes={p.content ?? []} />
            </p>
          ))}
        </li>
      ))}
    </ul>
  );
}

function Inline({ nodes }: { nodes: RichTextInline[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === "hardBreak") return <br key={i} />;
        let content: React.ReactNode = node.text;
        const marks = new Set(node.marks?.map((m) => m.type));
        if (marks.has("italic")) content = <em>{content}</em>;
        if (marks.has("bold")) content = <strong>{content}</strong>;
        return <Fragment key={i}>{content}</Fragment>;
      })}
    </>
  );
}
