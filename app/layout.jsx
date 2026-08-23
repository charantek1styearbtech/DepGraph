import "./globals.css";

export const metadata = {
  title: "DepGraph — Dependency Risk Graph",
  description:
    "Understand direct and transitive dependency risk in your projects. Powered by CognoDB and openCypher.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
