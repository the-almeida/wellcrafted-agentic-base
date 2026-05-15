import type { Metadata } from 'next'

import { LegalPage } from '@/shared/ui/legal-page'

export const metadata: Metadata = {
  title: 'Account & Data Deletion',
  description:
    'How to delete your {{COMPANY_NAME}} account and the personal data we hold about you.',
}

export default function DataDeletionPage() {
  return (
    <LegalPage title="Account &amp; Data Deletion" lastUpdated="{{LAST_UPDATED}}">
      <p>
        You can request deletion of your <strong>{'{{COMPANY_NAME}}'}</strong> account at any time.
        This page describes the three paths available and what happens to your data after a deletion
        request is received.
      </p>

      <h2>1. Delete your account from the app</h2>
      <p>If you can sign in:</p>
      <ul>
        <li>
          Go to <a href="/account">your account page</a>.
        </li>
        <li>
          Click <strong>Request account deletion</strong>.
        </li>
      </ul>
      <p>
        Your account is immediately put into a soft-deleted state. You will no longer be able to use
        the service&rsquo;s normal features &mdash; only the cancellation interstitial &mdash; and
        your account will be permanently deleted after a{' '}
        <strong>{'{{ACCOUNT_DELETION_GRACE_DAYS}}'}-day</strong> grace period. You can cancel the
        deletion at any time during the grace period by signing in again.
      </p>

      <h2>2. Remove the app from Facebook</h2>
      <p>
        If you signed up using Facebook and remove the app from your Facebook settings, Facebook
        notifies us automatically. We then create a deletion request on your behalf using the same{' '}
        <strong>{'{{ACCOUNT_DELETION_GRACE_DAYS}}'}-day</strong> grace period described above.
        Facebook will provide you with a status URL where you can check the progress of your
        deletion.
      </p>
      <p>
        To remove the app: in Facebook, open{' '}
        <a href="https://www.facebook.com/settings?tab=applications" rel="noreferrer">
          Settings &rarr; Apps and Websites
        </a>
        , find <strong>{'{{COMPANY_NAME}}'}</strong>, and click <strong>Remove</strong>.
      </p>

      <h2>3. Email us</h2>
      <p>
        If you cannot sign in, or you would prefer to request deletion in writing, email{' '}
        <a href="mailto:{{DPO_EMAIL}}">{'{{DPO_EMAIL}}'}</a> from the address registered with your
        account. We will verify your identity, create a deletion request on your behalf, and confirm
        by email.
      </p>

      <h2>What happens to your data</h2>
      <p>
        After the grace period ends, we permanently delete your account and the personal data
        associated with it. Data that we are legally required to retain (for example, accounting
        records, regulatory disclosures) is kept only for as long as those obligations require and
        is otherwise inaccessible.
      </p>
      <p>
        Anonymised data &mdash; data from which you can no longer be identified, alone or in
        combination with other information &mdash; is outside the scope of personal data under LGPD
        Art. 12 and may be retained for analytics, research, or service improvement.
      </p>

      <h2>Questions</h2>
      <p>
        For any other questions about deletion or your rights as a data subject, contact our Data
        Protection Officer at <a href="mailto:{{DPO_EMAIL}}">{'{{DPO_EMAIL}}'}</a>. See our{' '}
        <a href="/privacy">Privacy Policy</a> for the full list of rights you can exercise.
      </p>
    </LegalPage>
  )
}
