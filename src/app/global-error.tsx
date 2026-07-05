"use client";

// App Router global error boundary. Catches errors thrown in the root layout
// and unhandled React render errors, forwarding them to Sentry (a no-op when
// no DSN is configured). Rendered outside the normal layout, so it ships its
// own <html>/<body>.

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
