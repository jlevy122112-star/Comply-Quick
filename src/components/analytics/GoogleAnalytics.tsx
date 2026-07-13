import Script from "next/script";
import { isSpeedOptimizationEnabled } from "@/lib/optimizations/flags";

/**
 * Google Analytics 4 (gtag.js) loader.
 *
 * Renders nothing unless NEXT_PUBLIC_GA4_ID is set, so local/dev/CI never loads
 * the tag. Lives in the root layout so it covers the marketing site and the
 * authenticated app. Uses afterInteractive so it never blocks first paint.
 */
// GA4 measurement IDs look like "G-XXXXXXXXXX". Validate before injecting so a
// misconfigured env var can never break out of the string literal into the
// inline script (defense against injection via NEXT_PUBLIC_GA4_ID).
const GA4_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/i;

export function GoogleAnalytics() {
  if (!isSpeedOptimizationEnabled()) return null;
  const measurementId = process.env.NEXT_PUBLIC_GA4_ID;
  if (!measurementId || !GA4_ID_PATTERN.test(measurementId)) return null;

  const id = JSON.stringify(measurementId);
  return (
    <>
      <Script
        id="ga4-src"
        strategy="lazyOnload"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
      />
      <Script id="ga4-init" strategy="lazyOnload">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
        var cqInitGa=function(){gtag('js',new Date());gtag('config',${id});};
        if('requestIdleCallback' in window){requestIdleCallback(cqInitGa,{timeout:2000});}
        else{setTimeout(cqInitGa,1200);}`}
      </Script>
    </>
  );
}
