import { DeepDiveSection } from "@/lib/types";
import AnimationContainer from "./AnimationContainer";

function renderMarkdown(text: string) {
  // Simple markdown-like rendering for basic formatting
  // Split into paragraphs, handle code blocks, headers, tables, and lists
  const parts = text.split(/\n\n+/);

  return parts.map((part, i) => {
    const trimmed = part.trim();

    // Code block
    if (trimmed.startsWith("```")) {
      const lines = trimmed.split("\n");
      const code = lines.slice(1, -1).join("\n");
      return (
        <pre
          key={i}
          className="bg-[#0d1117] border border-[var(--border)] rounded-lg p-4 overflow-x-auto text-sm font-mono my-4"
        >
          <code>{code}</code>
        </pre>
      );
    }

    // Table
    if (trimmed.includes("|") && trimmed.includes("---")) {
      const rows = trimmed
        .split("\n")
        .filter((r) => !r.match(/^\s*\|?\s*-+/));
      const headers = rows[0]
        ?.split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      const body = rows.slice(1).map((r) =>
        r
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean)
      );
      return (
        <div key={i} className="overflow-x-auto my-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {headers?.map((h, j) => (
                  <th
                    key={j}
                    className="text-left p-2 text-[var(--muted)] font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, j) => (
                <tr key={j} className="border-b border-[var(--border)]">
                  {row.map((cell, k) => (
                    <td key={k} className="p-2 font-mono">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // Header
    if (trimmed.startsWith("### ")) {
      return (
        <h4 key={i} className="text-lg font-bold mt-6 mb-2">
          {trimmed.slice(4)}
        </h4>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h3 key={i} className="text-xl font-bold mt-6 mb-2">
          {trimmed.slice(3)}
        </h3>
      );
    }

    // List
    if (trimmed.match(/^[-*] /m)) {
      const items = trimmed.split(/\n/).filter((l) => l.match(/^[-*] /));
      return (
        <ul key={i} className="list-disc list-inside space-y-1 my-3">
          {items.map((item, j) => (
            <li key={j} className="text-[var(--foreground)]">
              {formatInline(item.replace(/^[-*] /, ""))}
            </li>
          ))}
        </ul>
      );
    }

    // Paragraph
    return (
      <p key={i} className="my-3 leading-relaxed">
        {formatInline(trimmed)}
      </p>
    );
  });
}

function formatInline(text: string) {
  // Very basic inline formatting: **bold**, `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="bg-[var(--border)] px-1.5 py-0.5 rounded text-sm font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export default function ContentRenderer({
  sections,
}: {
  sections: DeepDiveSection[];
}) {
  return (
    <div className="space-y-8">
      {sections.map((section, i) => (
        <section key={i}>
          <h2 className="text-xl font-bold mb-4 pb-2 border-b border-[var(--border)]">
            {section.title}
          </h2>

          {section.type === "text" && section.content && (
            <div>{renderMarkdown(section.content)}</div>
          )}

          {section.type === "animation" && (
            <div>
              {section.content && (
                <p className="text-[var(--muted)] mb-4">{section.content}</p>
              )}
              <AnimationContainer animationId={section.animationId!} />
            </div>
          )}

          {section.type === "code" && section.content && (
            <pre className="bg-[#0d1117] border border-[var(--border)] rounded-lg p-4 overflow-x-auto text-sm font-mono">
              <code>{section.content}</code>
            </pre>
          )}

          {section.type === "computation" && section.content && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
              {renderMarkdown(section.content)}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
