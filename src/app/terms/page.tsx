import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service | GradFolio" };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-100 bg-white p-8 shadow-sm md:p-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to home
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: April 17, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">1. Acceptance of terms</h2>
            <p className="mt-2">
              By creating an account or using GradFolio (&ldquo;the Service&rdquo;), you agree to
              these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">2. Eligibility</h2>
            <p className="mt-2">
              GradFolio is intended for students enrolled in partner institutions and
              employers engaging with them. You must provide accurate, complete
              information during registration and keep it current.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">3. Your account</h2>
            <p className="mt-2">
              You are responsible for safeguarding your credentials and for all
              activity under your account. Notify us immediately of any unauthorized
              access. We may suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">4. User content</h2>
            <p className="mt-2">
              You retain ownership of the submissions, portfolio content, and other
              materials you upload. By submitting content, you grant GradFolio a
              non-exclusive license to host, display, and share it as required to
              operate the Service (including with reviewers and, where applicable,
              employers you choose to engage with).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">5. Acceptable use</h2>
            <p className="mt-2">
              You agree not to: (a) submit content you did not author or do not have
              rights to share; (b) misrepresent your identity or affiliations; (c)
              interfere with the Service&apos;s operation or security; or (d) use the
              Service for unlawful purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">6. Third-party services</h2>
            <p className="mt-2">
              The Service integrates with third-party providers (authentication,
              email delivery, hosting). Your use of those features is also subject to
              their terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">7. Disclaimer</h2>
            <p className="mt-2">
              The Service is provided &ldquo;as is&rdquo; without warranties of any kind. We do
              not guarantee that submissions will lead to employment, grades, or any
              specific outcome.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">8. Changes</h2>
            <p className="mt-2">
              We may update these Terms from time to time. Continued use of the
              Service after changes take effect constitutes acceptance of the updated
              Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">9. Contact</h2>
            <p className="mt-2">
              Questions about these Terms? Contact your institution&apos;s GradFolio
              administrator.
            </p>
          </section>
        </div>

        <div className="mt-10 border-t border-slate-100 pt-6 text-sm text-slate-500">
          See also our{" "}
          <Link href="/privacy" className="font-semibold text-indigo-600 hover:text-indigo-800">
            Privacy Policy
          </Link>
          .
        </div>
      </div>
    </main>
  );
}
