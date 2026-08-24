/* Envia um push vazio para o telemovel subscrito.
   Nao conhece — nem pode conhecer — nada sobre o ciclo ou a gravidez:
   a decisao do que mostrar e tomada pelo service worker, no dispositivo.

   O GitHub so aceita horarios em UTC, que nao acompanha a mudanca da hora
   em Portugal. Por isso a rotina e acordada duas vezes (18h e 19h UTC) e
   e aqui que se verifica se sao mesmo 19h em Lisboa. */

const webpush = require("web-push");

const { VAPID_PUBLICA, VAPID_PRIVADA, SUBSCRICAO, EVENTO } = process.env;

if (!VAPID_PUBLICA || !VAPID_PRIVADA || !SUBSCRICAO) {
  console.error("Faltam os secrets VAPID_PUBLICA, VAPID_PRIVADA ou SUBSCRICAO.");
  process.exit(1);
}

const horaEmLisboa = Number(
  new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", hour: "numeric", hour12: false }).format(new Date())
);

// a correr a mao, envia sempre; por horario, so as 19h de Lisboa
if (EVENTO !== "workflow_dispatch" && horaEmLisboa !== 19) {
  console.log(`Sao ${horaEmLisboa}h em Lisboa, nao sao 19h. Nada a fazer.`);
  process.exit(0);
}

webpush.setVapidDetails("mailto:entretempos@exemplo.pt", VAPID_PUBLICA, VAPID_PRIVADA);

webpush
  .sendNotification(JSON.parse(SUBSCRICAO), "")
  .then(() => console.log("Toque enviado."))
  .catch((erro) => {
    if (erro.statusCode === 404 || erro.statusCode === 410) {
      console.error("A subscricao expirou. Subscreve outra vez na aplicacao e atualiza o secret SUBSCRICAO.");
      process.exit(1);
    }
    console.error("Falhou:", erro.statusCode, erro.body);
    process.exit(1);
  });
