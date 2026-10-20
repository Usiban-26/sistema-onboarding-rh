export const metadata = {
  title: 'Portal de Onboarding - RH',
  description: 'Sistema interno de admissão e onboarding',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#f1f5f9' }}>
        {children}
      </body>
    </html>
  );
}
