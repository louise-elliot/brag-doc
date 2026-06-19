import * as Sentry from "@sentry/nextjs";

import { sentryEnabled, sentryInitOptions } from "./sentry.config";

if (sentryEnabled()) {
  Sentry.init(sentryInitOptions());
}
