import * as Sentry from "@sentry/nextjs";

import { sentryEnabled, sentryInitOptions } from "./sentry.config";

export async function register() {
  if (sentryEnabled()) {
    Sentry.init(sentryInitOptions());
  }
}

export const onRequestError = Sentry.captureRequestError;
