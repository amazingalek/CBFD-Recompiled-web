// Cross-origin isolation for a host that can't set response headers (GitHub Pages). A page with threads needs
// SharedArrayBuffer, which a browser only gives a page served with Cross-Origin-Opener-Policy: same-origin and
// Cross-Origin-Embedder-Policy: require-corp. Loaded by the page (shell.html) as a script, this registers itself as the
// page's service worker and reloads the page once; as the service worker, it adds the two headers to every response
// it passes on. A server that sends the headers itself makes the page isolated already, and this does nothing.
// The same idea as gzuidhof/coi-serviceworker, written anew.
if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
  self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
      return;
    }
    event.respondWith(fetch(request).then((response) => {
      if (response.status === 0) {
        return response;
      }
      const headers = new Headers(response.headers);
      headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }));
  });
} else if (window.isSecureContext && navigator.serviceWorker) {
  // Reload once the worker controls the page; the session flag stops a loop where service workers are refused. It is
  // read and removed on every load, the isolated one after the reload too: left behind, it stopped the next page of
  // the origin opened in that tab (another game's, under a scope of its own) from registering and reloading.
  const reloaded = sessionStorage.getItem('coiReloaded');
  sessionStorage.removeItem('coiReloaded');
  if (!reloaded && !window.crossOriginIsolated) {
    navigator.serviceWorker.register(document.currentScript.src).then((registration) => {
      const reload = () => {
        sessionStorage.setItem('coiReloaded', '1');
        location.reload();
      };
      if (navigator.serviceWorker.controller) {
        reload();
      } else {
        registration.addEventListener('updatefound', () => registration.installing.addEventListener('statechange', (e) => {
          if (e.target.state === 'activated') {
            reload();
          }
        }));
        if (registration.active) {
          reload();
        }
      }
    }, (error) => console.error('The cross-origin isolation service worker could not register: ' + error));
  }
}
