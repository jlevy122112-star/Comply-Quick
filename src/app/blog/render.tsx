import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import type { BlogBlock } from "@/lib/blog";

// Minimal inline parser for blog paragraph/list text. Supports `[label](href)`
// links (internal hrefs starting with "/" render via next/link) and `**bold**`.
// Everything else is plain text — no HTML injection.
const TOKEN = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;

export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) nodes.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
    const [, label, href, bold] = m;
    if (href) {
      const internal = href.startsWith("/");
      nodes.push(
        internal ? (
          <Link key={key++} href={href} className="text-indigo-400 underline hover:text-indigo-300">
            {label}
          </Link>
        ) : (
          <a
            key={key++}
            href={href}
            className="text-indigo-400 underline hover:text-indigo-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            {label}
          </a>
        )
      );
    } else if (bold) {
      nodes.push(
        <strong key={key++} className="font-semibold text-white">
          {bold}
        </strong>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return nodes;
}

export function BlogBody({ body }: { body: BlogBlock[] }) {
  return (
    <div className="space-y-5">
      {body.map((block, i) => {
        switch (block.type) {
          case "h2":
            return (
              <h2 key={i} className="mt-10 text-2xl font-bold text-white">
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="mt-6 text-xl font-semibold text-white">
                {block.text}
              </h3>
            );
          case "p":
            return (
              <p key={i} className="text-base leading-relaxed text-gray-300">
                {renderInline(block.text)}
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-2 pl-6 text-gray-300">
                {block.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal space-y-2 pl-6 text-gray-300">
                {block.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ol>
            );
          case "callout":
            return (
              <div key={i} className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4">
                <p className="text-sm leading-relaxed text-indigo-100">{renderInline(block.text)}</p>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
