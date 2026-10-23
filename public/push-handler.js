/* Imported by the existing Workbox worker; does not replace offline caching. */
self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let message;
    try { message = event.data?.json(); } catch { return; }
    if (!message || typeof message.id !== "string" || typeof message.title !== "string" || typeof message.body !== "string" || !Number.isFinite(Date.parse(message.expiresAt)) || Date.parse(message.expiresAt) <= Date.now()) return;
    const routes = ["/", "/school", "/tasks", "/plan", "/money", "/calendar"];
    const route = routes.includes(message.route) ? message.route : "/";
    const tag = `pockit:${message.id.slice(0,200)}`;
    // Persist bounded delivery receipts outside the financial database. The
    // server also has a unique delivery key to deduplicate across retries.
    const cache = await caches.open("pockit-push-receipts-v1");
    const receipt = new URL(`push-receipt/${encodeURIComponent(tag)}`, self.registration.scope);
    if (await cache.match(receipt)) return;
    await self.registration.showNotification(message.title.slice(0,80), {
      body: message.body.slice(0,180), tag,
      icon: new URL("icons/icon-192.png", self.registration.scope).href,
      data: {url: `${self.registration.scope}#${route}`},
    });
    await cache.put(receipt, new Response("delivered"));
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - 256)).map(key => cache.delete(key)));
  })());
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const fallback = new URL(self.registration.scope);
    let url;
    try { url = new URL(event.notification.data?.url ?? fallback); } catch { url = fallback; }
    if (url.origin !== fallback.origin || url.pathname !== fallback.pathname) url = fallback;
    const windows = await self.clients.matchAll({type: "window", includeUncontrolled: true});
    for (const client of windows) {
      if (new URL(client.url).pathname === fallback.pathname) {
        await client.navigate(url.href); await client.focus(); return;
      }
    }
    await self.clients.openWindow(url.href);
  })());
});
