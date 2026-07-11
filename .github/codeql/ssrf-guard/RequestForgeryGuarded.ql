/**
 * @name Server-side request forgery (guarded-dispatcher aware)
 * @description Making a network request with user-controlled data in the URL allows for request
 *              forgery attacks. This variant treats requests pinned to the application's
 *              SSRF-guarded undici dispatcher (getScanDispatcher) as sanitized, since that
 *              dispatcher re-validates the resolved IP against private ranges at socket-connect
 *              time, closing the DNS-rebinding gap. All other SSRF sinks are still reported.
 * @kind path-problem
 * @problem.severity error
 * @security-severity 9.1
 * @precision high
 * @id js/request-forgery-guarded
 * @tags security
 *       external/cwe/cwe-918
 */

import javascript
import semmle.javascript.security.dataflow.RequestForgeryQuery
import semmle.javascript.security.dataflow.RequestForgeryCustomizations::RequestForgery
import RequestForgeryFlow::PathGraph

/**
 * The URL argument of a request that is pinned to the application's SSRF-guarded
 * dispatcher (a call to `getScanDispatcher`). Such a request cannot open a socket
 * to a private/loopback address even under DNS rebinding, so the URL is safe.
 */
class GuardedDispatcherUrl extends Sanitizer {
  GuardedDispatcherUrl() {
    exists(DataFlow::CallNode call, DataFlow::Node dispatcher |
      this = call.getArgument(0) and
      dispatcher = call.getOptionArgument(1, "dispatcher") and
      dispatcher.getALocalSource().(DataFlow::CallNode).getCalleeName() = "getScanDispatcher"
    )
  }
}

from RequestForgeryFlow::PathNode source, RequestForgeryFlow::PathNode sink, DataFlow::Node request
where
  RequestForgeryFlow::flowPath(source, sink) and
  request = sink.getNode().(Sink).getARequest()
select request, source, sink, "The $@ of this request depends on a $@.", sink.getNode(),
  sink.getNode().(Sink).getKind(), source, "user-provided value"
