import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReviewedEmail } from "@/lib/email";

/**
 * Admin-only endpoint to verify Resend wiring end-to-end.
 *
 *   GET  /api/admin/test-email              → sends to the signed-in admin
 *   GET  /api/admin/test-email?to=foo@x.com → sends to a specific address
 *
 * Reports the exact env + Resend error details in JSON so you can diagnose.
 */
export async function GET(request: Request) {
  const { user } = await requireSuperAdmin();

  const url = new URL(request.url);
  const toParam = url.searchParams.get("to");

  // Env diagnostics (no secret values — just whether they're set)
  const envCheck = {
    RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
    EMAIL_FROM: process.env.EMAIL_FROM ?? "(unset — using default)",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "(unset)",
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { ok: false, stage: "env", error: "RESEND_API_KEY is not set", envCheck },
      { status: 500 }
    );
  }

  // Resolve recipient: ?to=... OR the admin's own email
  let recipient = toParam;
  if (!recipient) {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(user.id);
    recipient = data?.user?.email ?? null;
  }

  if (!recipient) {
    return NextResponse.json(
      { ok: false, stage: "recipient", error: "Could not resolve recipient email", envCheck },
      { status: 400 }
    );
  }

  try {
    const result = await sendReviewedEmail({
      toEmail: recipient,
      studentName: "Test Student",
      taskTitle: "Email delivery test",
      taskId: "00000000-0000-0000-0000-000000000000",
      reviewStatus: "approved",
      score: 5,
      feedback:
        "This is a test email sent from /api/admin/test-email to verify your Resend wiring. If you received this, you're good to go.",
    });

    if (result?.error) {
      return NextResponse.json(
        {
          ok: false,
          stage: "resend",
          sentTo: recipient,
          error: result.error,
          envCheck,
          hint: "Check the error above. Common causes: wrong API key, unverified sender domain (EMAIL_FROM must use a verified domain OR 'onboarding@resend.dev' with recipient = your Resend account email), rate limits.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      sentTo: recipient,
      note: "Email dispatched to Resend. Check your inbox and the Resend dashboard logs.",
      envCheck,
      resendTip:
        "If using onboarding@resend.dev (default dev sender), Resend only delivers to the email on your Resend account. For real users, verify a domain in Resend first.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        stage: "exception",
        error: err instanceof Error ? err.message : String(err),
        envCheck,
      },
      { status: 500 }
    );
  }
}
