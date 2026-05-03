<<<<<<< HEAD
import type { Metadata } from 'next';
import { QueryProvider } from '@/providers/QueryProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Time Calendar Manager',
  description: 'Your intelligent time and calendar management system',
=======
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Time Calendar Manager",
  description: "Task and calendar management app",
>>>>>>> origin/blocks/jus-24-task-panel-sidebar-task-list-with-crud-and-drag-handles
};

export default function RootLayout({
  children,
<<<<<<< HEAD
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900 antialiased">
=======
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
>>>>>>> origin/blocks/jus-24-task-panel-sidebar-task-list-with-crud-and-drag-handles
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
