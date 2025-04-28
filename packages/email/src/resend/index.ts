import { Resend } from "resend";
import { ResendEmailOptions } from "./types";

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const VARIANT_TO_FROM_MAP = {
  primary: "RefList <system@thereflist.com>",
  notifications: "RefList <notifications@mail.thereflist.com>",
  marketing: "Steven from RefList <steven@ship.thereflist.com>",
};

// Send email using Resend (Recommended for production)
export const sendEmailViaResend = async (opts: ResendEmailOptions) => {
  if (!resend) {
    console.info(
      "RESEND_API_KEY is not set in the .env. Skipping sending email.",
    );
    return;
  }

  const {
    email,
    from,
    variant = "primary",
    bcc,
    replyTo,
    subject,
    text,
    react,
    scheduledAt,
  } = opts;

  return await resend.emails.send({
    to: email,
    from: from || VARIANT_TO_FROM_MAP[variant],
    bcc: bcc,
    replyTo: replyTo || "support@dub.co",
    subject,
    text,
    react,
    scheduledAt,
    ...(variant === "marketing" && {
      headers: {
        "List-Unsubscribe": "https://app.thereflist.com/account/settings",
      },
    }),
  });
};
