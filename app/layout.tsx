import type { Metadata, Viewport } from "next";
import { Baloo_2, Figtree, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Letra redondeada y gruesa, en la línea del logo de Mamipan
const display = Baloo_2({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });
const body = Figtree({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Tareas Mamipan",
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
