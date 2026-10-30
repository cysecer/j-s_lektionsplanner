import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { clubFaviconId } from "@/lib/club/favicon";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const [t, faviconId] = await Promise.all([getTranslations("app"), clubFaviconId()]);
  // The club's own icon if an admin set one; otherwise app/favicon.ico.
  // The id in the URL makes browsers fetch a new icon when it changes.
  const icons: Metadata["icons"] = faviconId
    ? {
        icon: [{ url: `/api/favicon?size=32&v=${faviconId}`, sizes: "32x32", type: "image/png" }],
        apple: [{ url: `/api/favicon?size=180&v=${faviconId}`, sizes: "180x180" }],
      }
    : undefined;
  return { title: t("name"), description: t("description"), icons };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background flex min-h-full flex-col">
        <NextIntlClientProvider>
          {children}
          <Toaster theme="light" position="top-center" richColors closeButton />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
