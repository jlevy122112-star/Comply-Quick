import Script from "next/script";
import { isSpeedOptimizationEnabled } from "@/lib/optimizations/flags";

/**
 * Microsoft Clarity heatmap + session-recording loader.
 *
 * Renders nothing unless NEXT_PUBLIC_CLARITY_ID is set, so local/dev/CI never
 * loads the tag. Because it lives in the root layout it covers both the
 * marketing site and the authenticated app. Uses afterInteractive so it never
 * blocks first paint.
 */
// Clarity project IDs are short alphanumeric tokens. Validate before injecting
// so a misconfigured env var can never break out of the string literal into the
// inline script (defense against script injection via NEXT_PUBLIC_CLARITY_ID).
const CLARITY_ID_PATTERN = /^[a-z0-9]{1,32}$/i;

export function Clarity() {
  if (!isSpeedOptimizationEnabled()) return null;
  const projectId = process.env.NEXT_PUBLIC_CLARITY_ID;
  if (!projectId || !CLARITY_ID_PATTERN.test(projectId)) return null;

  return (
    <Script id="ms-clarity" strategy="lazyOnload">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        var cqLoad=function(){
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        };
        if('requestIdleCallback' in c){c.requestIdleCallback(cqLoad,{timeout:2500});}
        else{setTimeout(cqLoad,1500);}
      })(window, document, "clarity", "script", ${JSON.stringify(projectId)});`}
    </Script>
  );
}
