const webpush = require("web-push");
const { VAPID_PUBLICA, VAPID_PRIVADA, SUBSCRICAO } = process.env;

if (!VAPID_PUBLICA || !VAPID_PRIVADA || !SUBSCRICAO) {
console.error("Faltam os secrets VAPID_PUBLICA, VAPID_PRIVADA ou SUBSCRICAO.");
process.exit(1);
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
