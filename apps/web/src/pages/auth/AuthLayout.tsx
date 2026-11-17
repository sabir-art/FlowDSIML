import type { ReactNode } from 'react';
import { Card } from '@flowdsiml/ui';
import { LanguageSwitch } from '../../components/LanguageSwitch';

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page" id="main">
      <Card className="auth-card">
        <h1>{title}</h1>
        {subtitle && <p className="fd-muted">{subtitle}</p>}
        {children}
        <div style={{ marginTop: 24 }}>
          <LanguageSwitch />
        </div>
      </Card>
    </main>
  );
}
