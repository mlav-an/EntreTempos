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

const VERSAO = "entretempos-v32";

const FICHEIROS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest",
  "./icone-192.png",
  "./icone-512.png",
  "./fruta-04.png",
  "./fruta-05.png",
  "./fruta-06.png",
  "./fruta-07.png",
  "./fruta-08.png",
  "./fruta-09.png",
  "./fruta-10.png",
  "./fruta-11.png",
  "./fruta-12.png",
  "./fruta-13.png",
  "./fruta-14.png",
  "./fruta-15.png",
  "./fruta-16.png",
  "./fruta-17.png",
  "./fruta-18.png",
  "./fruta-19.png",
  "./fruta-20.png",
  "./fruta-21.png",
  "./fruta-22.png",
  "./fruta-23.png",
  "./fruta-24.png",
  "./fruta-25.png",
  "./fruta-26.png",
  "./fruta-27.png",
  "./fruta-28.png",
  "./fruta-29.png",
  "./fruta-30.png",
  "./fruta-31.png",
  "./fruta-32.png",
  "./fruta-33.png",
  "./fruta-34.png",
  "./fruta-35.png",
  "./fruta-36.png",
  "./fruta-37.png",
  "./fruta-38.png",
  "./fruta-39.png",
  "./fruta-40.png",
  "./fruta-41.png",
  "./animal-04.png",
  "./animal-05.png",
  "./animal-06.png",
  "./animal-07.png",
  "./animal-08.png",
  "./animal-09.png",
  "./animal-10.png",
  "./animal-11.png",
  "./animal-12.png",
  "./animal-13.png",
  "./animal-14.png",
  "./animal-15.png",
  "./animal-16.png",
  "./animal-17.png",
  "./animal-18.png",
  "./animal-19.png",
  "./animal-20.png",
  "./animal-21.png",
  "./animal-22.png",
  "./animal-23.png",
  "./animal-24.png",
  "./animal-25.png",
  "./animal-26.png",
  "./animal-27.png",
  "./animal-28.png",
  "./animal-29.png",
  "./animal-30.png",
  "./animal-31.png",
  "./animal-32.png",
  "./animal-33.png",
  "./animal-34.png",
  "./animal-35.png",
  "./animal-36.png",
  "./animal-37.png",
  "./animal-38.png",
  "./animal-39.png",
  "./animal-40.png",
  "./animal-41.png",
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

async function verificarLembretes(umaVezPorDia = true) {
  const bruto = await ler(CHAVE_ESTADO);
  if (!bruto) return;
  let estado;
  try {
    estado = typeof bruto === "string" ? JSON.parse(bruto) : bruto;
  } catch (err) {
    return;
  }

  const hoje = chaveHoje();
  if (umaVezPorDia) {
    const avisado = await ler(CHAVE_AVISADO);
    if (avisado === hoje) return;
  }

  const n = estado.notificacoes || {};
  const textos = [];

  // lembrete da fotografia: semanal, no dia em que muda a semana de gravidez
  const g = estado.gravidez;
  if (n.selfie && g && g.ativa && g.dum) {
    const dias = Math.round((new Date(hoje) - new Date(g.dum)) / 86400000);
    if (dias >= 0 && dias % 7 === 0) {
      const semana = Math.floor(dias / 7);
      const inicioSemana = new Date(new Date(g.dum).getTime() + semana * 7 * 86400000).toISOString().slice(0, 10);
      const temFoto = !!estado.ultimaFoto && estado.ultimaFoto >= inicioSemana;
      if (!temFoto) textos.push(`Hora da selfie! Começou a semana ${semana}.`);
    }
  }

  // restantes lembretes: vêm já calculados pela aplicação
  const agenda = estado.agenda;
  const agendaDeHoje = agenda && agenda.data === hoje && Array.isArray(agenda.textos);
  if (agendaDeHoje) textos.push(...agenda.textos);

  /* Se a aplicação não foi aberta hoje, a agenda está velha. O check-in não
     precisa dela: basta ver se existe registo do dia.                      */
  if (!agendaDeHoje && n.checkin) {
    const r = (estado.registos || {})[hoje];
    const temRegisto =
      !!r &&
      (r.humor != null ||
        r.energia != null ||
        r.peso != null ||
        r.movimentos != null ||
        (r.sintomas && r.sintomas.length) ||
        (r.notas && r.notas.trim()) ||
        r.fluxo ||
        (r.etiquetas && r.etiquetas.length));
    if (!temRegisto) textos.push("Ainda não registaste como te sentes hoje.");
  }

  if (textos.length === 0) return;

  await self.registration.showNotification("EntreTempos", {
    body: textos.length > 1 ? `${textos[0]} (+${textos.length - 1})` : textos[0],
    tag: `entretempos-${hoje}`,
    icon: "./icone-192.png",
    badge: "./icone-192.png",
  });
  await escrever(CHAVE_AVISADO, hoje);
}

/* Acordado pelo sistema na aplicação instalada (Android). */
self.addEventListener("periodicsync", (evento) => {
  if (evento.tag === "entretempos-lembretes") evento.waitUntil(verificarLembretes());
});

/* Acordado por um push. O servidor não envia conteúdo nenhum: basta o
   toque, e a decisão do que mostrar é tomada aqui, no dispositivo.   */
self.addEventListener("push", (evento) => {
  evento.waitUntil(verificarLembretes(true));
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
