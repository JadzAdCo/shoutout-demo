const fs = require("fs");
const p = "floqr-i18n-help.js";
let s = fs.readFileSync(p, "utf8");
const blocks = {
  ru: {
    title: "Рекламные кампании",
    body: "Выберите Business account в My Profile, чтобы открыть Ad Campaigns. Inline ($45 / 7 дней — во время использования FloqR) или Mingl Gist ($25 / 7 дней — при прокрутке Mingl). Загрузите PNG/JPEG/GIF или вставьте HTML. Аудитория: все или datapoints профиля. Отправка уходит Master Admin на одобрение и расписание."
  },
  nl: {
    title: "Advertentiecampagnes",
    body: "Kies een Business account in My Profile om Ad Campaigns te openen. Inline ($45 / 7 dagen — tijdens FloqR-gebruik) of Mingl Gist ($25 / 7 dagen — tijdens Mingl-scrollen). Upload PNG/JPEG/GIF of plak HTML. Richt je op alle patrons of op profiel-datapoints. Indienen gaat naar Master Admin voor goedkeuring en planning."
  },
  fr: {
    title: "Campagnes publicitaires",
    body: "Choisissez un compte Business dans My Profile pour ouvrir Ad Campaigns. Inline (45 $ / 7 jours — pendant l’usage de FloqR) ou Mingl Gist (25 $ / 7 jours — en scrollant Mingl). Téléversez PNG/JPEG/GIF ou collez du HTML. Ciblez tous les patrons ou des datapoints. L’envoi part vers Master Admin pour approbation et planning."
  },
  de: {
    title: "Werbekampagnen",
    body: "Wählen Sie in My Profile ein Business-Konto, um Ad Campaigns zu öffnen. Inline (45 $ / 7 Tage — während FloqR-Nutzung) oder Mingl Gist (25 $ / 7 Tage — beim Mingl-Scrollen). PNG/JPEG/GIF hochladen oder HTML einfügen. Zielgruppe: alle oder Profildatenpunkte. Einreichung geht an Master Admin zur Freigabe und Planung."
  },
  es: {
    title: "Campañas publicitarias",
    body: "Elige una cuenta Business en My Profile para abrir Ad Campaigns. Inline (45 $ / 7 días — al usar FloqR) o Mingl Gist (25 $ / 7 días — al desplazarte en Mingl). Sube PNG/JPEG/GIF o pega HTML. Dirige a todos o a datapoints del perfil. El envío va a Master Admin para aprobación y programación."
  },
  it: {
    title: "Campagne pubblicitarie",
    body: "Scegli un account Business in My Profile per aprire Ad Campaigns. Inline (45 $ / 7 giorni — durante l’uso di FloqR) o Mingl Gist (25 $ / 7 giorni — scorrendo Mingl). Carica PNG/JPEG/GIF o incolla HTML. Pubblico: tutti o datapoint del profilo. L’invio va a Master Admin per approvazione e pianificazione."
  },
  pt: {
    title: "Campanhas publicitárias",
    body: "Escolha uma conta Business em My Profile para abrir Ad Campaigns. Inline (45 $ / 7 dias — ao usar o FloqR) ou Mingl Gist (25 $ / 7 dias — ao percorrer o Mingl). Carregue PNG/JPEG/GIF ou cole HTML. Público: todos ou datapoints do perfil. O envio vai para Master Admin para aprovação e agendamento."
  },
  el: {
    title: "Διαφημιστικές καμπάνιες",
    body: "Επιλέξτε Business account στο My Profile για Ad Campaigns. Inline (45 $ / 7 ημέρες — κατά τη χρήση FloqR) ή Mingl Gist (25 $ / 7 ημέρες — στο scroll του Mingl). Ανεβάστε PNG/JPEG/GIF ή επικολλήστε HTML. Κοινό: όλοι ή datapoints προφίλ. Υποβολή στον Master Admin για έγκριση και προγραμματισμό."
  },
  pl: {
    title: "Kampanie reklamowe",
    body: "Wybierz konto Business w My Profile, aby otworzyć Ad Campaigns. Inline (45 $ / 7 dni — podczas używania FloqR) lub Mingl Gist (25 $ / 7 dni — podczas przewijania Mingl). Prześlij PNG/JPEG/GIF lub wklej HTML. Grupy: wszyscy lub datapointy profilu. Wysłanie trafia do Master Admin do zatwierdzenia i harmonogramu."
  },
  ar: {
    title: "حملات إعلانية",
    body: "اختر حساب Business في My Profile لفتح Ad Campaigns. Inline (45$ / 7 أيام — أثناء استخدام FloqR) أو Mingl Gist (25$ / 7 أيام — أثناء التمرير في Mingl). ارفع PNG/JPEG/GIF أو الصق HTML. الجمهور: الجميع أو نقاط بيانات الملف. الإرسال يذهب إلى Master Admin للموافقة والجدولة."
  }
};

for (const [lang, copy] of Object.entries(blocks)) {
  const needle = `    ${lang}: {\n      "help-completed-shoutouts": {`;
  const insert = `    ${lang}: {\n      "help-ad-campaigns": {\n        title: ${JSON.stringify(copy.title)},\n        body: ${JSON.stringify(copy.body)}\n      },\n      "help-completed-shoutouts": {`;
  if (s.includes(`"help-ad-campaigns"`) && lang === "ru" && (s.match(/help-ad-campaigns/g) || []).length >= 10) {
    continue;
  }
  if (!s.includes(needle)) {
    console.error("MISS pack", lang);
    process.exit(1);
  }
  if (s.includes(`    ${lang}: {\n      "help-ad-campaigns":`)) continue;
  s = s.replace(needle, insert);
}
s = s.replace(/VERSION = "s3\.0\.66"/, 'VERSION = "s3.0.76"');
fs.writeFileSync(p, s);
console.log("help-ad-campaigns", (s.match(/help-ad-campaigns/g) || []).length);
