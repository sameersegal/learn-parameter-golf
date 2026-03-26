"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Submission } from "@/lib/types";

type SortKey = "pr_number" | "val_bpb" | "author";
type SortDir = "asc" | "desc";

export default function Leaderboard({
  submissions,
}: {
  submissions: Submission[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("val_bpb");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    return [...submissions].sort((a, b) => {
      let av: string | number | null, bv: string | number | null;
      if (sortKey === "val_bpb") {
        av = a.val_bpb;
        bv = b.val_bpb;
      } else if (sortKey === "pr_number") {
        av = a.pr_number;
        bv = b.pr_number;
      } else {
        av = a.author;
        bv = b.author;
      }
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [submissions, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "val_bpb" ? "asc" : "desc");
    }
  }

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--muted)]">
            <th className="text-center p-2 w-10">Record</th>
            <th
              className="text-left p-2 cursor-pointer hover:text-white w-16"
              onClick={() => toggleSort("pr_number")}
            >
              PR#{arrow("pr_number")}
            </th>
            <th className="text-left p-2">Title</th>
            <th
              className="text-left p-2 cursor-pointer hover:text-white"
              onClick={() => toggleSort("author")}
            >
              Author{arrow("author")}
            </th>
            <th
              className="text-right p-2 cursor-pointer hover:text-white"
              onClick={() => toggleSort("val_bpb")}
            >
              val_bpb{arrow("val_bpb")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr
              key={s.pr_number}
              className="border-b border-[var(--border)] hover:bg-[var(--border)]/30 transition-colors"
            >
              <td className="p-2 text-center">
                {s.is_record && (
                  <span className="text-[var(--accent)]" title="Record submission">
                    ★
                  </span>
                )}
              </td>
              <td className="p-2">
                <a
                  href={`https://github.com/openai/parameter-golf/pull/${s.pr_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  #{s.pr_number}
                </a>
              </td>
              <td className="p-2">
                <Link
                  href={`/pr/${s.pr_number}`}
                  className="no-underline text-[var(--foreground)] hover:text-white"
                >
                  {s.title}
                </Link>
              </td>
              <td className="p-2 text-[var(--muted)]">{s.author}</td>
              <td className="p-2 text-right font-mono">
                {s.val_bpb?.toFixed(4) ?? "N/A"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
