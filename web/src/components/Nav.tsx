"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/constants";

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-[var(--border)] bg-[var(--card)]">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-6">
        <Link href="/" className="font-bold text-lg text-[var(--accent)] no-underline">
          Parameter Golf
        </Link>
        <div className="flex gap-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm no-underline transition-colors ${
                pathname === link.href
                  ? "text-white font-medium"
                  : "text-[var(--muted)] hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
