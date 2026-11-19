"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavTabs() {
  const path = usePathname();
  const tabs = [
    { href: "/", label: "Tareas", active: path === "/" || path.startsWith("/tareas") },
    { href: "/calendario", label: "Calendario", active: path.startsWith("/calendario") },
    { href: "/eventos", label: "Eventos", active: path.startsWith("/eventos") },
  ];
  return (
    <nav className="appbar-tabs" aria-label="Secciones">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className="tab" aria-current={t.active ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
