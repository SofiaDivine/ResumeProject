import type { Metadata } from "next";
import { Literata, Manrope } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const sans = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
});

const serif = Literata({
  subsets: ["latin", "cyrillic"],
  style: ["normal", "italic"],
  variable: "--font-literata",
});

export const metadata: Metadata = {
  title: {
    default: "Savoria",
    template: "%s · Savoria",
  },
  description: "Recipes from what is already at home: time, heat, and the things you would rather leave out.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
