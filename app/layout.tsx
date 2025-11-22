import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Telegram Greeting Scheduler',
  description: 'Schedule Telegram greetings with delay per account',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
