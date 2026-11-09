# Local preview connection issue

## Observed failure

During Phase 3 desktop review, the studio and API processes reported listeners on `127.0.0.1:5173` and `127.0.0.1:4318`. Chrome and a separate shell request to those loopback addresses timed out. The canvas code was not implicated by that evidence; the browser never loaded it.

The strongest current explanation is that the dev processes and desktop Chrome run in different network namespaces, so each process's `127.0.0.1` points to a different loopback interface. This is an inference from the timeouts and process context, not yet a confirmed platform diagnosis. A Chrome proxy issue is less likely because Chromium documents an implicit proxy bypass for localhost and loopback IPs.

## Recovery steps

1. Start Vite and the API from the same Windows user environment that owns the desktop Chrome session, or use the platform's supported preview/port-forwarding bridge if the processes must stay in a sandbox.
2. Confirm the processes are listening on the expected ports (`5173` for Vite and `4318` for the API) from that same environment. Check Vite's `/` route and the API's `/api/health` route with a request that bypasses proxies.
3. Open the Vite URL in Chrome. If the page loads but API calls fail, verify the Vite `/api` proxy still targets the API port and check both process logs.
4. Review the editor at the laptop and desktop artboard presets. Check canvas selection, drag/resize, nested flex/grid content, design-system panel behavior, save, and reload.
5. Record the browser result and screenshots, then close the Phase 3 review item.

Keep the listeners bound to loopback when running on the same host. Do not work around the issue by exposing the dev server to every interface, disabling browser proxy/security behavior, or allowing every Vite host. Vite documents the DNS-rebinding risk of `server.allowedHosts: true`; use the platform's supported preview mechanism when cross-namespace access is required.

## References

- [OpenAI sandbox agents: exposing an app preview port](https://developers.openai.com/api/docs/guides/agents/sandboxes)
- [Vite server options: host, allowed hosts, and CORS](https://vite.dev/config/server-options)
- [Chromium proxy configuration and localhost bypass](https://github.com/chromium/chromium/blob/main/net/docs/proxy.md)
- [Windows proxy settings and local-address bypass](https://support.microsoft.com/en-us/windows/experience/connectivity-networking/use-a-proxy-server-in-windows)
