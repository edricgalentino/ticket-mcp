import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ticket MCP",
  description: "A ticket tracker that agents can drive over MCP.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      {/* Clerk Core 3: the provider goes inside <body>, not around <html>. */}
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
