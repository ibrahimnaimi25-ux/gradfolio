import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy | GradFolio" };

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: April 17, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">1. Information we collect</h2>
            <p className="mt-2">
              We collect information you provide directly: name, email, major, and
              submissions. If you sign in with Google, we receive your name, email,
              and profile picture from Google. We also log basic usage data to keep
              the Service secure and reliable.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">2. How we use information</h2>
            <p className="mt-2">
              We use your information to operate the Service: authenticate you,
              display your portfolio and submissions, notify you about reviews and
              deadlines, and share your work with reviewers and (with your consent)
              employers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">3. Sharing</h2>
            <p className="mt-2">
              We do not sell your personal data. We share information only with:
              your institution&apos;s administrators, reviewers assigned to your
              submissions, employers you choose to engage with, and service providers
              we use to run the Service (hosting, email delivery, authentication).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">4. Cookies &amp; sessions</h2>
            <p className="mt-2">
              We use cookies strictly to keep you signed in and to remember your
              preferences. We do not use advertising or cross-site tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">5. Data retention</h2>
            <p className="mt-2">
              We retain your account and submission data for as long as your account
              is active. You may request deletion by contacting your institution&apos;s
              administrator; some data may be retained where required by law or to
              resolve disputes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">6. Security</h2>
            <p className="mt-2">
              We use industry-standard measures to protect your data, including
              encrypted connections and scoped database access. No system is perfectly
              secure, however, and you are responsible for protecting your credentials.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">7. Your rights</h2>
            <p className="mt-2">
              Depending on your jurisdiction, you may have the right to access,
              correct, or delete your personal data, or to object to certain
              processing. Contact your institution&apos;s GradFolio administrator to
              exercise these rights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">8. Children</h2>
            <p className="mt-2">
              GradFolio is not directed to children under 13, and we do not knowingly
              collect data from them.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">9. Changes</h2>
            <p className="mt-2">
              We may update this Policy from time to time. If changes are material,
              we will notify you through the Service or by email.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">10. Contact</h2>
            <p className="mt-2">
              Questions about this Policy? Contact your institution&apos;s GradFolio
              administrator.
            </p>
          </section>
        </div>

        <div className="mt-10 border-t border-slate-100 pt-6 text-sm text-slate-500">
          See also our{" "}
          <Link href="/terms" className="font-semibold text-indigo-600 hover:text-indigo-800">
            Terms of Service
          </Link>
          .
        </div>
      </div>
    </main>
  );
}
