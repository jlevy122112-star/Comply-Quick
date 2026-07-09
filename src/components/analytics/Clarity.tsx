import Script from "next/script";

/**
 * Microsoft Clarity heatmap + session-recording loader.
 *
 * Renders nothing unless NEXT_PUBLIC_CLARITY_ID is set, so local/dev/CI never
 * loads the tag. Because it lives in the root layout it covers both the
 * marketing site and the authenticated app. Uses afterInteractive so it never
 * blocks first paint.
 */
export function Clarity() {
  const projectId = process.env.NEXT_PUBLIC_CLARITY_ID;
  if (!projectId) return null;

  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${projectId}");`}
    </Script>
  );
}
