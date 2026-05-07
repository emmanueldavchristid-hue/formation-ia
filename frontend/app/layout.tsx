import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IA Formation Bancaire",
  description: "Assistant IA pour la formation bancaire",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <nav className="bg-blue-900 text-white px-6 py-4 flex items-center gap-8 shadow-lg">
          <span className="text-xl font-bold">🎓 Formation IA</span>
          <Link href="/" className="hover:text-blue-200 transition-colors">Accueil</Link>
          <Link href="/formateur" className="hover:text-blue-200 transition-colors">Formateur</Link>
          <Link href="/cours" className="hover:text-blue-200 transition-colors">Mes cours</Link>
          <Link href="/chat" className="hover:text-blue-200 transition-colors">Assistant</Link>
        </nav>
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
      </body>
    </html>
  );
}
