"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Live monitor" },
  { href: "/calls", label: "Call history" },
  { href: "/policies", label: "Policy packs" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="flex h-screen flex-col bg-[#f7f8fa]">
      <header className="flex shrink-0 items-center gap-6 border-b border-[#e4e7ec] bg-white px-5">
        <Link href="/" className="flex items-center gap-2 py-3">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-[#4f46e5] text-[13px] font-bold text-white">
            S
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-[#101828]">
            Sentinel
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((n) => {
            const active = path === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-[#eef2ff] text-[#4f46e5]"
                    : "text-[#475467] hover:bg-[#f2f4f7]"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3 py-2">
          <span className="hidden text-[12px] text-[#667085] sm:inline">
            Support operations
          </span>
          <div className="grid h-7 w-7 place-items-center rounded-full bg-[#eef2ff] text-[11px] font-semibold text-[#4f46e5]">
            AS
          </div>
        </div>
      </header>

      {/* Sub-pages scroll; the live dashboard opts out with its own
          overflow-hidden wrapper. Clipping here broke scrolling everywhere. */}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
