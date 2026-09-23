export const metadata = {
  title: 'SMTP test',
  description: 'Sending transactional email from Next.js over plain SMTP.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
