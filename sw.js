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

const VERSAO = "entretempos-v6";

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
  if (d.tipo === "verificar") evento.waitUntil(verificarLembretes());
  if (d.tipo === "notificar") {
    self.registration.showNotification("EntreTempos", {
      body: d.texto || "Tens um lembrete.",
      tag: d.etiqueta || "entretempos",
      badge: "./icone-192.png",
      icon: "./icone-192.png",
      badge: "./icone-192.png",
    });
  }
});


/* ---------------------- leitura do IndexedDB --------------------- */
/* A aplicação escreve o estado e uma "agenda" com os textos do dia.
   Aqui só se lê: nenhum dado sai do dispositivo.                    */

const BD = "entretempos";
const LOJA = "dados";
const CHAVE_ESTADO = "ciclo:estado:v1";
const CHAVE_AVISADO = "entretempos:avisado";

function abrirBD() {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BD, 1);
    pedido.onupgradeneeded = () => {
      const bd = pedido.result;
      if (!bd.objectStoreNames.contains(LOJA)) bd.createObjectStore(LOJA);
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

function ler(chave) {
  return abrirBD().then(
    (bd) =>
      new Promise((resolve) => {
        const t = bd.transaction(LOJA, "readonly");
        const p = t.objectStore(LOJA).get(chave);
        p.onsuccess = () => resolve(p.result);
        p.onerror = () => resolve(undefined);
      })
  );
}

function escrever(chave, valor) {
  return abrirBD().then(
    (bd) =>
      new Promise((resolve) => {
        const t = bd.transaction(LOJA, "readwrite");
        t.objectStore(LOJA).put(valor, chave);
        t.oncomplete = () => resolve(true);
        t.onerror = () => resolve(false);
      })
  );
}

/* ------------------------ lembretes do dia ----------------------- */

const doisDigitos = (n) => String(n).padStart(2, "0");

function chaveHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

function passouAHora(hora) {
  const [h, m] = (hora || "20:00").split(":").map(Number);
  const agora = new Date();
  return agora.getHours() > h || (agora.getHours() === h && agora.getMinutes() >= m);
}

async function verificarLembretes() {
  const bruto = await ler(CHAVE_ESTADO);
  if (!bruto) return;
  let estado;
  try {
    estado = typeof bruto === "string" ? JSON.parse(bruto) : bruto;
  } catch (err) {
    return;
  }

  const hoje = chaveHoje();
  const avisado = await ler(CHAVE_AVISADO);
  if (avisado === hoje) return; // um aviso por dia

  const n = estado.notificacoes || {};
  const textos = [];

  // lembrete da fotografia: semanal, no dia em que muda a semana de gravidez
  const g = estado.gravidez;
  if (n.selfie && g && g.ativa && g.dum && passouAHora(n.horaSelfie)) {
    const dias = Math.round((new Date(hoje) - new Date(g.dum)) / 86400000);
    if (dias >= 0 && dias % 7 === 0) {
      const semana = Math.floor(dias / 7);
      const inicioSemana = new Date(new Date(g.dum).getTime() + semana * 7 * 86400000)
        .toISOString()
        .slice(0, 10);
      const temFoto = !!estado.ultimaFoto && estado.ultimaFoto >= inicioSemana;
      if (!temFoto) textos.push(`Hora da selfie! Começou a semana ${semana}.`);
    }
  }

  // restantes lembretes: vêm já calculados pela aplicação
  const agenda = estado.agenda;
  if (agenda && agenda.data === hoje && Array.isArray(agenda.textos)) textos.push(...agenda.textos);

  if (textos.length === 0) return;

  await escrever(CHAVE_AVISADO, hoje);
  await self.registration.showNotification("EntreTempos", {
    body: textos[0],
    tag: `entretempos-${hoje}`,
    icon: "./icone-192.png",
    badge: "./icone-192.png",
  });
}

/* Acordado pelo sistema na aplicação instalada (Android). */
self.addEventListener("periodicsync", (evento) => {
  if (evento.tag === "entretempos-lembretes") evento.waitUntil(verificarLembretes());
});

/* Acordado por um push. O servidor não envia conteúdo nenhum: basta o
   toque, e a decisão do que mostrar é tomada aqui, no dispositivo.   */
self.addEventListener("push", (evento) => {
  evento.waitUntil(verificarLembretes());
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
