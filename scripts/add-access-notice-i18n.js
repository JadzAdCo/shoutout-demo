#!/usr/bin/env node
/* s3.1.24: visible "could not load / no access" notice (floqr-access-notice.js) — chrome keys in all 11 packs. */
"use strict";

const fs = require("fs");
const path = require("path");

const file = path.resolve(__dirname, "..", "floqr-i18n.js");
const q = s => JSON.stringify(s);
const CHROME_ORDER = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];
const KEYS = ["access.denied", "access.failed", "access.dismiss"];

const T = {
  en: ["Some information on this page is hidden because your account does not have access to it.", "Some information on this page could not load. Refresh the page to try again.", "Dismiss"],
  fr: ["Certaines informations de cette page sont masquées car votre compte n'y a pas accès.", "Certaines informations de cette page n'ont pas pu être chargées. Actualisez la page pour réessayer.", "Fermer"],
  de: ["Einige Informationen auf dieser Seite sind ausgeblendet, weil Ihr Konto keinen Zugriff darauf hat.", "Einige Informationen auf dieser Seite konnten nicht geladen werden. Laden Sie die Seite neu, um es erneut zu versuchen.", "Schließen"],
  es: ["Parte de la información de esta página está oculta porque tu cuenta no tiene acceso.", "Parte de la información de esta página no se pudo cargar. Actualiza la página para intentarlo de nuevo.", "Cerrar"],
  nl: ["Sommige informatie op deze pagina is verborgen omdat je account er geen toegang toe heeft.", "Sommige informatie op deze pagina kon niet worden geladen. Vernieuw de pagina om het opnieuw te proberen.", "Sluiten"],
  ru: ["Часть информации на этой странице скрыта, потому что у вашей учётной записи нет к ней доступа.", "Не удалось загрузить часть информации на этой странице. Обновите страницу, чтобы повторить попытку.", "Закрыть"],
  it: ["Alcune informazioni in questa pagina sono nascoste perché il tuo account non ha accesso.", "Alcune informazioni in questa pagina non sono state caricate. Aggiorna la pagina per riprovare.", "Chiudi"],
  pt: ["Algumas informações desta página estão ocultas porque a sua conta não tem acesso a elas.", "Não foi possível carregar algumas informações desta página. Atualize a página para tentar novamente.", "Fechar"],
  el: ["Ορισμένες πληροφορίες σε αυτή τη σελίδα είναι κρυφές επειδή ο λογαριασμός σας δεν έχει πρόσβαση σε αυτές.", "Δεν ήταν δυνατή η φόρτωση ορισμένων πληροφοριών σε αυτή τη σελίδα. Ανανεώστε τη σελίδα για να δοκιμάσετε ξανά.", "Κλείσιμο"],
  pl: ["Część informacji na tej stronie jest ukryta, ponieważ Twoje konto nie ma do nich dostępu.", "Nie udało się wczytać części informacji na tej stronie. Odśwież stronę, aby spróbować ponownie.", "Zamknij"],
  ar: ["بعض المعلومات في هذه الصفحة مخفية لأن حسابك لا يملك صلاحية الوصول إليها.", "تعذّر تحميل بعض المعلومات في هذه الصفحة. حدّث الصفحة للمحاولة مرة أخرى.", "إغلاق"]
};

let src = fs.readFileSync(file, "utf8");
if (src.includes(`${q(KEYS[0])}:`)) {
  console.log("access notice keys already present");
  process.exit(0);
}
const eol = src.includes("\r\n") ? "\r\n" : "\n";
const anchor = /^( *)"floqai\.classicSearch": .*\r?\n/gm;
const hits = [...src.matchAll(anchor)];
if (hits.length !== CHROME_ORDER.length) throw new Error(`anchor hits ${hits.length}`);
let offset = 0;
hits.forEach((m, i) => {
  const lang = CHROME_ORDER[i];
  if (T[lang].length !== KEYS.length) throw new Error(`${lang} has ${T[lang].length} strings`);
  T[lang].forEach((value, k) => {
    const want = (T.en[k].match(/\{\w+\}/g) || []).sort().join();
    const got = (value.match(/\{\w+\}/g) || []).sort().join();
    if (want !== got) throw new Error(`${lang} ${KEYS[k]} placeholders ${got} != ${want}`);
  });
  const block = KEYS.map((key, k) => `${m[1]}${q(key)}: ${q(T[lang][k])},${eol}`).join("");
  const pos = m.index + m[0].length + offset;
  src = src.slice(0, pos) + block + src.slice(pos);
  offset += block.length;
});
fs.writeFileSync(file, src);
console.log(`access notice: ${KEYS.length} chrome keys x ${CHROME_ORDER.length}`);
