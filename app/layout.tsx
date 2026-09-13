import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'CommerceWA - Plateforme & Agent Commercial WhatsApp',
  description: 'Plateforme de commande multi-tenant avec agent commercial WhatsApp automatisé, gestion de commandes et relances automatiques.',
  openGraph: {
    title: 'CommerceWA - Plateforme & Agent Commercial WhatsApp',
    description: 'Plateforme de commande multi-tenant avec agent commercial WhatsApp automatisé, gestion de commandes et relances automatiques.',
  },
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

