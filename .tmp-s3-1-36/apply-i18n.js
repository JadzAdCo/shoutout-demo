"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const LANGS = ["en", "de", "fr", "es", "it", "pt", "ru", "el", "pl", "nl", "ar"];

const ROWS = {
  embedSignedOut: [
    "You're signed in on FLOQR My Profile — restoring that session here. If this stays blank, refresh My Profile (not Google on this panel).",
    "Du bist in FLOQR Mein Profil angemeldet — die Sitzung wird hier wiederhergestellt. Bleibt das leer, lade Mein Profil neu (nicht Google in diesem Bereich).",
    "Vous êtes connecté sur FLOQR Mon profil — la session est rétablie ici. Si rien ne s'affiche, actualisez Mon profil (pas Google dans ce panneau).",
    "Has iniciado sesión en FLOQR Mi perfil — restauramos esa sesión aquí. Si sigue en blanco, actualiza Mi perfil (no Google en este panel).",
    "Hai effettuato l'accesso in FLOQR Il mio profilo — ripristiniamo qui la sessione. Se resta vuoto, aggiorna Il mio profilo (non Google in questo pannello).",
    "Você está conectado no FLOQR Meu perfil — restaurando a sessão aqui. Se continuar em branco, atualize Meu perfil (não use Google neste painel).",
    "Вы вошли в FLOQR «Мой профиль» — восстанавливаем сессию здесь. Если панель пустая, обновите «Мой профиль» (не Google в этой панели).",
    "Έχετε συνδεθεί στο FLOQR Το προφίλ μου — η σύνδεση επαναφέρεται εδώ. Αν μείνει κενό, ανανεώστε το Το προφίλ μου (όχι Google σε αυτό το πλαίσιο).",
    "Jesteś zalogowany w FLOQR Mój profil — przywracamy tu tę sesję. Jeśli nic się nie pojawi, odśwież Mój profil (nie Google w tym panelu).",
    "Je bent ingelogd op FLOQR Mijn profiel — die sessie wordt hier hersteld. Blijft dit leeg, vernieuw dan Mijn profiel (niet Google in dit paneel).",
    "أنت مسجّل الدخول في ملفي الشخصي على FLOQR — نستعيد الجلسة هنا. إذا بقيت فارغة، حدّث ملفي الشخصي (وليس Google في هذه اللوحة)."
  ],
  standaloneSignedOut: [
    "Opening the FLOQR sign-in page. After you sign in, you come straight back here.",
    "Die FLOQR-Anmeldeseite wird geöffnet. Nach der Anmeldung kommst du direkt hierher zurück.",
    "Ouverture de la page de connexion FLOQR. Après la connexion, vous revenez directement ici.",
    "Abriendo la página de inicio de sesión de FLOQR. Después de iniciar sesión, vuelves directamente aquí.",
    "Apertura della pagina di accesso FLOQR. Dopo l'accesso torni direttamente qui.",
    "Abrindo a página de login do FLOQR. Depois de entrar, você volta direto para cá.",
    "Открываем страницу входа FLOQR. После входа вы сразу вернётесь сюда.",
    "Άνοιγμα της σελίδας σύνδεσης FLOQR. Μετά τη σύνδεση επιστρέφετε κατευθείαν εδώ.",
    "Otwieramy stronę logowania FLOQR. Po zalogowaniu wrócisz prosto tutaj.",
    "De FLOQR-inlogpagina wordt geopend. Na het inloggen kom je direct hier terug.",
    "جارٍ فتح صفحة تسجيل الدخول إلى FLOQR. بعد تسجيل الدخول تعود إلى هنا مباشرة."
  ],
  restoring: [
    "Restoring your FLOQR session…",
    "Deine FLOQR-Sitzung wird wiederhergestellt…",
    "Restauration de votre session FLOQR…",
    "Restaurando tu sesión de FLOQR…",
    "Ripristino della sessione FLOQR…",
    "Restaurando sua sessão FLOQR…",
    "Восстанавливаем сессию FLOQR…",
    "Επαναφορά της σύνδεσής σας στο FLOQR…",
    "Przywracanie sesji FLOQR…",
    "Je FLOQR-sessie wordt hersteld…",
    "جارٍ استعادة جلستك في FLOQR…"
  ],
  openMyProfile: [
    "Open My Profile & Settings",
    "Mein Profil & Einstellungen öffnen",
    "Ouvrir Mon profil et paramètres",
    "Abrir Mi perfil y ajustes",
    "Apri Il mio profilo e impostazioni",
    "Abrir Meu perfil e configurações",
    "Открыть «Мой профиль и настройки»",
    "Άνοιγμα Το προφίλ μου & Ρυθμίσεις",
    "Otwórz Mój profil i ustawienia",
    "Mijn profiel & instellingen openen",
    "افتح ملفي الشخصي والإعدادات"
  ],
  popupBlocked: [
    "Sign in on My Profile & Settings first. Google popups are not used inside this panel.",
    "Melde dich zuerst unter Mein Profil & Einstellungen an. Google-Pop-ups werden in diesem Bereich nicht verwendet.",
    "Connectez-vous d'abord dans Mon profil et paramètres. Les fenêtres Google ne sont pas utilisées dans ce panneau.",
    "Inicia sesión primero en Mi perfil y ajustes. Las ventanas emergentes de Google no se usan en este panel.",
    "Accedi prima da Il mio profilo e impostazioni. I popup di Google non vengono usati in questo pannello.",
    "Entre primeiro em Meu perfil e configurações. Pop-ups do Google não são usados neste painel.",
    "Сначала войдите в «Мой профиль и настройки». Всплывающие окна Google в этой панели не используются.",
    "Συνδεθείτε πρώτα από Το προφίλ μου & Ρυθμίσεις. Τα αναδυόμενα παράθυρα Google δεν χρησιμοποιούνται σε αυτό το πλαίσιο.",
    "Najpierw zaloguj się w Mój profil i ustawienia. Wyskakujące okna Google nie są używane w tym panelu.",
    "Log eerst in via Mijn profiel & instellingen. Google-pop-ups worden in dit paneel niet gebruikt.",
    "سجّل الدخول أولًا من ملفي الشخصي والإعدادات. لا تُستخدم نوافذ Google المنبثقة داخل هذه اللوحة."
  ]
};

function eolOf(src) { return src.includes("\r\n") ? "\r\n" : "\n"; }

function main() {
  const keys = Object.keys(ROWS);
  keys.forEach(key => {
    if (ROWS[key].length !== LANGS.length) throw new Error(`${key}: ${ROWS[key].length} values`);
  });
  const file = path.join(ROOT, "floqr-i18n.js");
  let src = fs.readFileSync(file, "utf8");
  if (src.includes('"session.openMyProfile"')) { console.log("already applied"); return; }
  const eol = eolOf(src);
  const chromeAt = src.indexOf("const CHROME = {");
  if (chromeAt < 0) throw new Error("CHROME not found");
  LANGS.forEach((lang, li) => {
    const packRe = new RegExp(`\\n    ${lang}: \\{`, "g");
    packRe.lastIndex = chromeAt;
    const pack = packRe.exec(src);
    if (!pack) throw new Error(`pack ${lang}`);
    const anchor = src.indexOf('"sched.firebaseError"', pack.index);
    const nextPack = src.slice(pack.index + 1).search(/\n    [a-z]{2}: \{/);
    if (anchor < 0 || (nextPack >= 0 && anchor > pack.index + 1 + nextPack)) throw new Error(`anchor outside ${lang}`);
    const lineEnd = src.indexOf("\n", anchor) + 1;
    const lines = keys.map(key => `      ${JSON.stringify(`session.${key}`)}: ${JSON.stringify(ROWS[key][li])},${eol}`).join("");
    src = src.slice(0, lineEnd) + lines + src.slice(lineEnd);
  });
  fs.writeFileSync(file, src);
  console.log(`added ${keys.length} keys x ${LANGS.length} packs`);
}

main();
