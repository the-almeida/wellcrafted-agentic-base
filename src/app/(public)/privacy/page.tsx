import type { Metadata } from 'next'

import { LegalPage } from '@/shared/ui/legal-page'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How {{COMPANY_NAME}} collects, uses, retains, and discloses personal data, and how you can exercise your rights under LGPD and GDPR.',
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="{{LAST_UPDATED}}">
      <p>
        This Privacy Policy explains how <strong>{'{{COMPANY_NAME}}'}</strong> (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;) collects, uses, retains, discloses, and protects personal data. It is
        written to satisfy the disclosure obligations of Brazil&rsquo;s Lei Geral de Proteção de
        Dados (LGPD, Law No. 13.709/2018) and the EU General Data Protection Regulation (GDPR).
      </p>

      <h2>1. Controller and contact</h2>
      <p>
        The data controller is <strong>{'{{COMPANY_NAME}}'}</strong>, located at{' '}
        <strong>{'{{COMPANY_ADDRESS}}'}</strong>. General privacy inquiries should be sent to{' '}
        <a href="mailto:{{CONTACT_EMAIL}}">{'{{CONTACT_EMAIL}}'}</a>.
      </p>

      <h2>2. Data Protection Officer (DPO)</h2>
      <p>
        Our Data Protection Officer (Encarregado, under LGPD Art. 41) is{' '}
        <strong>{'{{DPO_NAME}}'}</strong>, reachable at{' '}
        <a href="mailto:{{DPO_EMAIL}}">{'{{DPO_EMAIL}}'}</a>. The DPO is the primary contact for
        questions about how your personal data is processed and for exercising your rights.
      </p>

      <h2>3. Personal data we process</h2>
      <ul>
        <li>
          <strong>Account data</strong>: email address, display name, authentication metadata, and
          OAuth identifiers (Google, Facebook) when you sign in via a third-party provider.
        </li>
        <li>
          <strong>Usage data</strong>: pages viewed, actions taken in the product, request
          timestamps, IP address, browser user-agent.
        </li>
        <li>
          <strong>Content</strong>: data you submit to the service through forms or uploads.
        </li>
        <li>
          <strong>Operational data</strong>: error events, performance traces, and audit logs
          required to keep the service running and secure.
        </li>
      </ul>

      <h2>4. Legal bases for processing</h2>
      <p>We rely on the following legal bases (LGPD Art. 7 / GDPR Art. 6):</p>
      <ul>
        <li>
          <strong>Contractual necessity</strong>: to deliver the service you signed up for.
        </li>
        <li>
          <strong>Legitimate interest</strong>: to operate, secure, and improve the service,
          balanced against your rights and expectations.
        </li>
        <li>
          <strong>Consent</strong>: for optional features, marketing communications, and
          non-essential cookies/analytics.
        </li>
        <li>
          <strong>Legal obligation</strong>: to comply with applicable law, court orders, and
          regulatory requests.
        </li>
      </ul>

      <h2>5. Purposes</h2>
      <ul>
        <li>Providing, maintaining, and improving the service.</li>
        <li>Authenticating users and securing accounts.</li>
        <li>Diagnosing failures and preventing abuse.</li>
        <li>Communicating with you about your account, security, and changes to the service.</li>
        <li>Meeting legal and regulatory obligations.</li>
      </ul>

      <h2>6. Retention</h2>
      <p>
        We retain personal data only as long as needed for the purposes above. Account data is
        deleted within <strong>{'{{ACCOUNT_DELETION_GRACE_DAYS}}'}</strong> days of a verified
        deletion request (see Section 10). Operational logs are retained for{' '}
        <strong>{'{{OPERATIONAL_LOG_RETENTION_DAYS}}'}</strong> days. Records required to satisfy
        legal obligations may be retained longer.
      </p>

      <h2>7. International transfers</h2>
      <p>
        Some of our infrastructure providers process data outside Brazil and the European Economic
        Area. By default, this service uses:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> (database and authentication) — region:{' '}
          <strong>{'{{SUPABASE_REGION}}'}</strong>.
        </li>
        <li>
          <strong>Sentry</strong> (error monitoring) — region:{' '}
          <strong>{'{{SENTRY_REGION}}'}</strong>.
        </li>
        <li>
          <strong>PostHog</strong> (product analytics) — region:{' '}
          <strong>{'{{POSTHOG_REGION}}'}</strong>.
        </li>
        <li>
          <strong>Vercel</strong> (application hosting) — region:{' '}
          <strong>{'{{VERCEL_REGION}}'}</strong>.
        </li>
      </ul>
      <p>
        Transfers rely on the safeguards permitted by LGPD Art. 33 and GDPR Chapter V (Standard
        Contractual Clauses, adequacy decisions, or your explicit consent where required).
      </p>

      <h2>8. Sharing</h2>
      <p>
        We do not sell personal data. We share data only with the processors listed above, with
        authorities when legally required, and with successors in the event of a corporate
        transaction (you will be notified before such a transfer).
      </p>

      <h2>9. Your rights</h2>
      <p>Under LGPD Art. 18 and GDPR Art. 15–22, you have the right to:</p>
      <ul>
        <li>Confirm whether we process your data, and access it.</li>
        <li>Correct incomplete, inaccurate, or outdated data.</li>
        <li>Request anonymisation, blocking, or deletion of unnecessary or excessive data.</li>
        <li>Port your data to another provider in a machine-readable format.</li>
        <li>Be informed about entities with which we share your data.</li>
        <li>Be informed about the consequences of refusing consent.</li>
        <li>Revoke consent, where consent was the basis for processing.</li>
        <li>Object to processing carried out on the basis of legitimate interest.</li>
      </ul>

      <h2>10. How to exercise your rights</h2>
      <p>
        To exercise any of the rights above, email{' '}
        <a href="mailto:{{DPO_EMAIL}}">{'{{DPO_EMAIL}}'}</a>. To delete your account, sign in and
        visit <a href="/account">your account page</a>, or follow the instructions at{' '}
        <a href="/data-deletion">/data-deletion</a>. We will respond within the timeframes required
        by applicable law.
      </p>

      <h2>11. Cookies</h2>
      <p>
        We use strictly necessary cookies to keep you signed in and to maintain the security of your
        session. Where we use non-essential cookies (for example, product analytics), we request
        consent through a separate notice before any such cookie is set.
      </p>

      <h2>12. Children</h2>
      <p>
        The service is not directed to children under <strong>{'{{MINIMUM_AGE}}'}</strong>. If you
        believe a child has provided personal data, contact the DPO and we will delete it.
      </p>

      <h2>13. Changes to this Policy</h2>
      <p>
        We may update this Policy from time to time. We will post the updated version at this URL
        and update the &ldquo;Last updated&rdquo; date above. Material changes will be communicated
        through the service or by email when appropriate.
      </p>
    </LegalPage>
  )
}
