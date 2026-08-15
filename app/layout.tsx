import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Chez Ami - Grillades & Maquis Dakar',
  description: 'Tableau de bord commerçant et plateforme de commande WhatsApp pour Chez Ami - Grillades & Maquis Dakar',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="fr">
      <body className="bg-[var(--color-bg)] text-[var(--color-text)] font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

