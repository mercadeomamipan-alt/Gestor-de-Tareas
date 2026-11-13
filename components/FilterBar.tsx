"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { STATUS } from "@/lib/types";

export function FilterBar({
  projects,
  showStatus = true,
  showSearch = true,
}: {
  projects: string[];
  showStatus?: boolean;
  showSearch?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  const set = (key: string, value: string, fallback = "") => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === fallback) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}${next.size ? "?" + next.toString() : ""}`, { scroll: false });
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q.trim()) set("q", q.trim());
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const who = params.get("quien") ?? "todas";
  const href = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === "todas") next.delete("quien");
    else next.set("quien", value);
    return `${pathname}${next.size ? "?" + next.toString() : ""}`;
  };

  return (
    <div className="filters">
      <div className="seg" role="group" aria-label="De quién">
        {[
          ["todas", "Todas"],
          ["mias", "Mías"],
          ["compartidas", "Compartidas"],
          ["otros", "De otros"],
        ].map(([v, l]) => (
          <a
            key={v}
            href={href(v)}
            aria-current={who === v ? "true" : undefined}
            onClick={(e) => {
              e.preventDefault();
              router.replace(href(v), { scroll: false });
            }}
          >
            {l}
          </a>
        ))}
      </div>
      {showStatus && (
      <select
        id="f-estado"
        aria-label="Estado"
        value={params.get("estado") ?? "abiertas"}
        onChange={(e) => set("estado", e.target.value, "abiertas")}
      >
        <option value="abiertas">Abiertas</option>
        <option value="todas">Todos los estados</option>
        {Object.entries(STATUS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      )}
      {projects.length > 0 && (
        <select
          id="f-proyecto"
          aria-label="Proyecto o área"
          value={params.get("proyecto") ?? ""}
          onChange={(e) => set("proyecto", e.target.value)}
        >
          <option value="">Todos los proyectos</option>
          {projects.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      )}
      {showSearch && (
        <input id="f-q" type="search" placeholder="Buscar tarea…" aria-label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
      )}
    </div>
  );
}
