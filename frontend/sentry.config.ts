import type { ErrorEvent } from "@sentry/nextjs";

// Production only. Init is skipped unless running in Vercel production with a DSN.
export function sentryEnabled(): boolean {
  const env =
    process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return env === "production" && Boolean(dsn);
}

export function sentryInitOptions() {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: "production",
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event: ErrorEvent): ErrorEvent {
      delete event.request;
      return event;
    },
  };
}
