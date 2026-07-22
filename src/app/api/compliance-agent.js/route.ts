import { NextResponse } from "next/server";

/**
 * Returns the minified compliance pixel bundle.
 *
 * Agencies install this snippet on client sites with a data-key attribute:
 *   <script src="https://app.com/api/compliance-agent.js" data-key="cq_live_..."></script>
 */
export async function GET() {
  const endpoint = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/pixel`;

  const bundle = `
(function(){
  var s=document.currentScript;
  var key=(s&&s.getAttribute('data-key'))||window.CQ_KEY;
  if(!key)return;
  var payload={key:key,url:location.href,title:document.title,referrer:document.referrer,t:Date.now(),
    w:window.innerWidth,h:window.innerHeight};
  var body=JSON.stringify(payload);
  var url='${endpoint}';
  if(!url||url==='/api/pixel'){url=location.protocol+'//'+location.host+'/api/pixel';}
  if(navigator.sendBeacon){navigator.sendBeacon(url,new Blob([body],{type:'application/json'}));}
  else{fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:body,keepalive:true}).catch(function(){})}
})();
`;

  return new NextResponse(bundle, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
