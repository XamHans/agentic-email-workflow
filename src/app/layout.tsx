import './globals.css'

export const metadata = {
  title: 'AI SDK Structured Output Demo',
  description: 'Demonstrating the difference between raw and structured AI responses',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}