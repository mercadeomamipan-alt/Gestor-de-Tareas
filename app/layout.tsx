import type { Metadata, Viewport } from "next";
import { Familjen_Grotesk, Figtree, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Familjen_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const body = Figtree({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Gestor de Tareas",
  description: "Tareas propias y compartidas, con fechas de entrega, requisitos y aprobaciones.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
