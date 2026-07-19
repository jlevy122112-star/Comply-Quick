// app/api/compliance-agent/route.ts
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const js = `
    (function() {
      var API_KEY = window.COMPLY_QUICK_API_KEY || null;
      if (!API_KEY) return;

      function sendTelemetry(eventType, payload) {
        try {
          fetch("https://YOUR-SUPABASE-PROJECT.functions.supabase.co/compliance-telemetry", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": API_KEY
            },
            body: JSON.stringify({
              eventType: eventType,
              url: window.location.href,
              userAgent: navigator.userAgent,
              payload: payload || {}
            })
          });
        } catch (e) {
          console.warn("Comply-Quick telemetry failed", e);
        }
      }

      // Initial page load
      sendTelemetry("page_load", { title: document.title });

      // DOM mutation observer (basic)
      var observer = new MutationObserver(function(mutations) {
        sendTelemetry("dom_mutation", { mutationCount: mutations.length });
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      // Global manual hook
      window.ComplyQuick = {
        track: function(eventType, payload) {
          sendTelemetry(eventType, payload);
        }
      };
    })();
  `.trim();

  return new NextResponse(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=600"
    }
  });
}
