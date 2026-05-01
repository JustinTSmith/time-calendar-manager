import type { Metadata } from 'next';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { SocketProvider } from '@/components/providers/SocketProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Time Calendar Manager',
  description: 'Manage your calendar and tasks in real-time',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <SocketProvider>
            {children}
          </SocketProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
