/* Envia um push vazio para o telemovel subscrito.
   Nao conhece — nem pode conhecer — nada sobre o ciclo ou a gravidez:
   a decisao do que mostrar e tomada pelo service worker, no dispositivo.

   O GitHub so aceita horarios em UTC e atrasa-se com frequencia (chega a
   uma hora). Por isso a rotina e acordada duas vezes — 18h e 19h UTC, que
   correspondem as 19h em Lisboa no verao e no inverno — e as duas enviam.
   Quem garante que so aparece um aviso por dia e o service worker, que
   ja mostrou algo hoje e nao repete. */

const webpush = require("web-push");

const { VAPID_PUBLICA, VAPID_PRIVADA, SUBSCRICAO } = process.env;

if (!VAPID_PUBLICA || !VAPID_PRIVADA || !SUBSCRICAO) {
  console.error("Faltam os secrets VAPID_PUBLICA, VAPID_PRIVADA ou SUBSCRICAO.");
  process.exit(1);
}

const horaEmLisboa = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date());

webpush.setVapidDetails("mailto:entretempos@exemplo.pt", VAPID_PUBLICA, VAPID_PRIVADA);

webpush
  .sendNotification(JSON.parse(SUBSCRICAO), "")
  .then(() => console.log(`Toque enviado. Sao ${horaEmLisboa} em Lisboa.`))
  .catch((erro) => {
    if (erro.statusCode === 404 || erro.statusCode === 410) {
      console.error("A subscricao expirou. Subscreve outra vez na aplicacao e atualiza o secret SUBSCRICAO.");
      process.exit(1);
    }
    console.error("Falhou:", erro.statusCode, erro.body);
    process.exit(1);
  });
