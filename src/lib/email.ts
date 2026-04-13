import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM =
  process.env.EMAIL_FROM ?? "GradFolio <noreply@gradfolio.com>";

const APP_URL =
  (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "") ||
  "https://gradfolio.vercel.app";

// ─── Shared styles ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  approved: "Approved",
  needs_revision: "Needs Revision",
  rejected: "Rejected",
};

const STATUS_COLOR: Record<string, string> = {
  approved: "#059669",
  needs_revision: "#d97706",
  rejected: "#dc2626",
};

const STATUS_BG: Record<string, string> = {
  approved: "#ecfdf5",
  needs_revision: "#fffbeb",
  rejected: "#fef2f2",
};

function emailWrapper(body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GradFolio</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#0f172a;border-radius:12px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="color:#fff;font-size:16px;font-weight:700;line-height:36px;">G</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="color:#0f172a;font-size:16px;font-weight:700;">GradFolio</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;padding:36px 40px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:20px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                GradFolio &middot; You received this email because you have an account.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Submission reviewed ──────────────────────────────────────────────────────

export async function sendReviewedEmail({
  toEmail,
  studentName,
  taskTitle,
  taskId,
  reviewStatus,
  score,
  feedback,
}: {
  toEmail: string;
  studentName: string;
  taskTitle: string;
  taskId: string;
  reviewStatus: string;
  score: number | null;
  feedback: string | null;
}) {
  const label = STATUS_LABEL[reviewStatus] ?? reviewStatus;
  const color = STATUS_COLOR[reviewStatus] ?? "#475569";
  const bg = STATUS_BG[reviewStatus] ?? "#f1f5f9";
  const stars = score
    ? `${"★".repeat(score)}${"☆".repeat(5 - score)} &nbsp;${score}/5`
    : null;

  const body = `
    <h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;">
      Your submission was reviewed
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;">
      Hi ${studentName}, your submission for <strong style="color:#0f172a;">${taskTitle}</strong> has been reviewed.
    </p>

    <!-- Status badge -->
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background:${bg};border:1px solid ${color}30;border-radius:100px;padding:6px 16px;">
          <span style="color:${color};font-size:13px;font-weight:600;">${label}</span>
        </td>
        ${stars ? `<td style="padding-left:12px;color:#92400e;font-size:13px;font-weight:600;">${stars}</td>` : ""}
      </tr>
    </table>

    ${
      feedback
        ? `<div style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;">Feedback</p>
        <p style="margin:0;font-size:14px;color:#334155;white-space:pre-wrap;line-height:1.6;">${feedback.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      </div>`
        : `<p style="margin:0 0 24px;font-size:14px;color:#64748b;">No additional feedback was provided.</p>`
    }

    <a href="${APP_URL}/tasks/${taskId}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;border-radius:10px;padding:12px 24px;font-size:14px;font-weight:600;">
      View submission &rarr;
    </a>
  `;

  const { error } = await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `Your submission for "${taskTitle}" has been reviewed`,
    html: emailWrapper(body),
  });

  if (error) {
    console.error("[email] sendReviewedEmail failed:", error);
  }
}

// ─── Deadline reminder ────────────────────────────────────────────────────────

export async function sendDeadlineReminderEmail({
  toEmail,
  studentName,
  taskTitle,
  taskId,
  dueDate,
}: {
  toEmail: string;
  studentName: string;
  taskTitle: string;
  taskId: string;
  dueDate: string; // e.g. "2026-04-14"
}) {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
  }).format(new Date(dueDate + "T00:00:00"));

  const body = `
    <h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;">
      Task due in 2 days
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;">
      Hi ${studentName}, just a reminder that the task below is due soon.
    </p>

    <div style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;">Task</p>
      <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#0f172a;">${taskTitle}</p>
      <p style="margin:0;font-size:13px;color:#64748b;">
        <span style="display:inline-block;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:3px 10px;color:#dc2626;font-weight:600;font-size:12px;">
          Due ${formatted}
        </span>
      </p>
    </div>

    <a href="${APP_URL}/tasks/${taskId}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;border-radius:10px;padding:12px 24px;font-size:14px;font-weight:600;">
      Submit now &rarr;
    </a>
  `;

  const { error } = await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `Reminder: "${taskTitle}" is due in 2 days`,
    html: emailWrapper(body),
  });

  if (error) {
    console.error("[email] sendDeadlineReminderEmail failed:", error);
  }
}
