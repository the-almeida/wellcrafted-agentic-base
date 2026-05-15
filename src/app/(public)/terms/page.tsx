import type { Metadata } from 'next'

import { LegalPage } from '@/shared/ui/legal-page'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing your use of {{COMPANY_NAME}}.',
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="{{LAST_UPDATED}}">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the service
        provided by <strong>{'{{COMPANY_NAME}}'}</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By
        creating an account or using the service, you agree to these Terms. If you do not agree, do
        not use the service.
      </p>

      <h2>1. The service</h2>
      <p>
        <strong>{'{{COMPANY_NAME}}'}</strong> provides <strong>{'{{SERVICE_DESCRIPTION}}'}</strong>.
        The features available to you depend on your account type and may change over time.
      </p>

      <h2>2. Eligibility and account</h2>
      <p>
        You must be at least <strong>{'{{MINIMUM_AGE}}'}</strong> years old to use the service. You
        are responsible for maintaining the confidentiality of your account credentials and for all
        activity under your account. Notify us promptly at{' '}
        <a href="mailto:{{CONTACT_EMAIL}}">{'{{CONTACT_EMAIL}}'}</a> of any unauthorised use.
      </p>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the service to violate any law or third-party right.</li>
        <li>
          Attempt to gain unauthorised access to the service, other accounts, or any related system
          or network.
        </li>
        <li>
          Probe, scan, or test the vulnerability of the service except through a coordinated
          disclosure programme.
        </li>
        <li>Interfere with the service&rsquo;s operation, including via automated traffic.</li>
        <li>
          Upload, transmit, or generate content that is unlawful, abusive, defamatory, or infringes
          the rights of others.
        </li>
      </ul>

      <h2>4. Your content</h2>
      <p>
        You retain all rights to the content you submit to the service. You grant us a limited,
        non-exclusive licence to host, store, process, and display your content solely to operate
        the service and to provide it to you. You are responsible for ensuring you have the rights
        necessary to submit the content.
      </p>

      <h2>5. Our intellectual property</h2>
      <p>
        The service, including its software, design, and trademarks, is owned by us and our
        licensors and is protected by applicable intellectual property laws. These Terms do not
        grant you any right to our trademarks or to copy, modify, or redistribute the service except
        as explicitly permitted.
      </p>

      <h2>6. Third-party services</h2>
      <p>
        The service may integrate with or link to third-party services (for example, Google or
        Facebook for sign-in). Your use of those services is governed by their own terms and privacy
        policies. We are not responsible for third-party services or content.
      </p>

      <h2>7. Disclaimers</h2>
      <p>
        Except as expressly stated in these Terms, the service is provided &ldquo;as is&rdquo; and
        &ldquo;as available&rdquo; without warranties of any kind, whether express or implied,
        including warranties of merchantability, fitness for a particular purpose, and
        non-infringement.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by applicable law, we will not be liable for indirect,
        incidental, special, consequential, or punitive damages, or for any loss of profits,
        revenue, data, or goodwill, arising from or related to your use of the service. Nothing in
        these Terms limits liability that cannot be limited under applicable law (including
        liability for wilful misconduct or gross negligence).
      </p>

      <h2>9. Termination</h2>
      <p>
        You may terminate your account at any time by following the instructions at{' '}
        <a href="/data-deletion">/data-deletion</a>. We may suspend or terminate your account if you
        materially breach these Terms or if required by law. On termination, the licence granted to
        you ends and your data is handled as described in our <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>10. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of <strong>{'{{JURISDICTION}}'}</strong>, without
        regard to its conflict-of-laws principles. The courts of <strong>{'{{FORUM}}'}</strong> have
        exclusive jurisdiction over any dispute arising from or related to these Terms, except where
        applicable consumer protection law gives you the right to bring proceedings in your place of
        residence.
      </p>

      <h2>11. Changes to the Terms</h2>
      <p>
        We may update these Terms from time to time. We will post the updated version at this URL
        and update the &ldquo;Last updated&rdquo; date above. Material changes will be communicated
        through the service or by email. Continuing to use the service after a change takes effect
        constitutes acceptance of the updated Terms.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these Terms: email{' '}
        <a href="mailto:{{CONTACT_EMAIL}}">{'{{CONTACT_EMAIL}}'}</a>.
      </p>
    </LegalPage>
  )
}
