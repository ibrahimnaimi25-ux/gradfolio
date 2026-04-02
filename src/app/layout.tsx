import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/navbar";

export const metadata: Metadata = {
  title: "GradFolio",
  description: "Build your portfolio by working on real-world tasks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-900 antialiased">
        <div className="min-h-screen">
          <Navbar />
          {children}
        </div>
      </body>
    </html>
  );
}