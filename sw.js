/* ------------------------------------------------------------------
   Service worker da aplicação EntreTempos.

   Faz duas coisas:
   1. guarda os ficheiros da aplicação para funcionar sem rede;
   2. mostra notificações quando lhe pedem (a partir da aplicação).

   Não guarda nem transmite dados do ciclo: esses vivem em IndexedDB,
   dentro do dispositivo.

   Sempre que alterares os ficheiros da aplicação, muda a VERSAO —
   é isso que faz o navegador ir buscar a versão nova.
   ------------------------------------------------------------------ */

const VERSAO = "entretempos-v3";

const FICHEIROS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest",
  "./icone-192.png",
  "./icone-512.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(VERSAO).then((cache) => cache.addAll(FICHEIROS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== VERSAO).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;

  // navegação: tenta a rede, cai na cópia guardada quando não há ligação
  if (pedido.mode === "navigate") {
    evento.respondWith(fetch(pedido).catch(() => caches.match("./index.html")));
    return;
  }

  evento.respondWith(
    caches.match(pedido).then(
      (guardado) =>
        guardado ||
        fetch(pedido).then((resposta) => {
          if (resposta && resposta.status === 200 && resposta.type === "basic") {
            const copia = resposta.clone();
            caches.open(VERSAO).then((cache) => cache.put(pedido, copia));
          }
          return resposta;
        })
    )
  );
});

/* Notificação pedida pela aplicação (funciona no Android e no iOS quando
   a aplicação está instalada no ecrã principal).                        */
self.addEventListener("message", (evento) => {
  const d = evento.data || {};
  if (d.tipo === "notificar") {
    self.registration.showNotification("EntreTempos", {
      body: d.texto || "Tens um lembrete.",
      tag: d.etiqueta || "entretempos",
      icon: "./icone-192.png",
      badge: "./icone-192.png",
    });
  }
});

/* Ao tocar na notificação, abre a aplicação em vez de um separador novo. */
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) if ("focus" in j) return j.focus();
      return self.clients.openWindow("./");
    })
  );
});
