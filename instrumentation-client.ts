// This file configures the initialization of Sentry on the client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://c9938aaf44435d8c6216085f1c3d2d88@o4511016223637504.ingest.de.sentry.io/4511016225407056",

  // Replay is lazy-loaded below to prevent ad blockers from crashing the app
  integrations: [],

  tracesSampleRate: 1,
  enableLogs: true,
  sendDefaultPii: true,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Lazy-load Replay so a blocked chunk doesn't crash the whole app
import("@sentry/nextjs")
  .then((lazyLoadedSentry) => {
    Sentry.addIntegration(lazyLoadedSentry.replayIntegration());
  })
  .catch(() => {
    // Ad blocker or network issue prevented loading — app continues to work
  });

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
