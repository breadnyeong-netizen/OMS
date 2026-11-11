"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_ITEMS, activeHref } from "./nav";

export function Sidebar() {
  const pathname = usePathname();
  const active = activeHref(pathname);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="fixed left-3 top-3 z-40 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm md:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="sidebar"
      >
        메뉴
      </button>
      <aside
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-30 w-56 border-r border-slate-200 bg-slate-900 text-slate-100 transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5 text-lg font-bold tracking-tight">OMS</div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={active === item.href ? "page" : undefined}
              className={`rounded-md px-3 py-2 text-sm ${
                active === item.href ? "bg-slate-700 font-semibold text-white" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
