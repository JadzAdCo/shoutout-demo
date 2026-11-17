#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

const chromeHelpBody = {
  en: [
    "Enter Ver, Vers, or Version to display this SMARTview. The command is case-insensitive. Longer questions like “what is your version?” still get a text answer plus this card.",
    "Enter Ver, Vers, or Version to display this SMARTview. The command is case-insensitive. The card is the only answer — there is no six-phase chat dump. Longer questions like “what is your version?” still get a short text line plus this card."
  ],
  fr: [
    "Saisissez Ver, Vers ou Version pour afficher ce SMARTview. La commande ignore la casse. Les questions plus longues comme « what is your version? » reçoivent encore une réponse texte plus cette carte.",
    "Saisissez Ver, Vers ou Version pour afficher ce SMARTview. La commande ignore la casse. La carte est la seule réponse — il n’y a pas de dump six-phase dans le chat. Les questions plus longues comme « what is your version? » reçoivent encore une courte ligne de texte plus cette carte."
  ],
  de: [
    "Geben Sie Ver, Vers oder Version ein, um dieses SMARTview anzuzeigen. Der Befehl ignoriert Groß/Kleinschreibung. Längere Fragen wie „what is your version?“ erhalten weiter eine Textantwort plus diese Karte.",
    "Geben Sie Ver, Vers oder Version ein, um dieses SMARTview anzuzeigen. Der Befehl ignoriert Groß/Kleinschreibung. Die Karte ist die einzige Antwort — es gibt keinen Six-Phase-Chat-Dump. Längere Fragen wie „what is your version?“ erhalten weiter eine kurze Textzeile plus diese Karte."
  ],
  es: [
    "Escriba Ver, Vers o Version para mostrar este SMARTview. El comando no distingue mayúsculas. Preguntas más largas como “what is your version?” siguen recibiendo una respuesta de texto más esta tarjeta.",
    "Escriba Ver, Vers o Version para mostrar este SMARTview. El comando no distingue mayúsculas. La tarjeta es la única respuesta — no hay un volcado six-phase en el chat. Preguntas más largas como “what is your version?” siguen recibiendo una línea corta más esta tarjeta."
  ],
  nl: [
    "Typ Ver, Vers of Version om dit SMARTview te tonen. De opdracht negeert hoofdletters. Langere vragen zoals “what is your version?” krijgen nog een tekstantwoord plus deze kaart.",
    "Typ Ver, Vers of Version om dit SMARTview te tonen. De opdracht negeert hoofdletters. De kaart is het enige antwoord — er is geen six-phase chatdump. Langere vragen zoals “what is your version?” krijgen nog een korte tekstregel plus deze kaart."
  ],
  ru: [
    "Введите Ver, Vers или Version, чтобы показать этот SMARTview. Регистр не важен. Более длинные вопросы вроде «what is your version?» по-прежнему получают текстовый ответ плюс эту карточку.",
    "Введите Ver, Vers или Version, чтобы показать этот SMARTview. Регистр не важен. Карточка — единственный ответ: шестифазного дампа в чате нет. Более длинные вопросы вроде «what is your version?» по-прежнему получают короткую строку плюс эту карточку."
  ],
  it: [
    "Inserisci Ver, Vers o Version per mostrare questo SMARTview. Il comando non distingue maiuscole. Domande più lunghe come “what is your version?” ricevono ancora una risposta testuale più questa scheda.",
    "Inserisci Ver, Vers o Version per mostrare questo SMARTview. Il comando non distingue maiuscole. La scheda è l’unica risposta — non c’è un dump six-phase in chat. Domande più lunghe come “what is your version?” ricevono ancora una riga breve più questa scheda."
  ],
  pt: [
    "Digite Ver, Vers ou Version para mostrar este SMARTview. O comando ignora maiúsculas. Perguntas mais longas como “what is your version?” ainda recebem uma resposta em texto mais este cartão.",
    "Digite Ver, Vers ou Version para mostrar este SMARTview. O comando ignora maiúsculas. O cartão é a única resposta — não há dump six-phase no chat. Perguntas mais longas como “what is your version?” ainda recebem uma linha curta mais este cartão."
  ],
  el: [
    "Πληκτρολογήστε Ver, Vers ή Version για αυτό το SMARTview. Η εντολή αγνοεί πεζά/κεφαλαία. Μεγαλύτερες ερωτήσεις όπως «what is your version;» παίρνουν ακόμη κείμενο συν αυτή την κάρτα.",
    "Πληκτρολογήστε Ver, Vers ή Version για αυτό το SMARTview. Η εντολή αγνοεί πεζά/κεφαλαία. Η κάρτα είναι η μόνη απάντηση — δεν υπάρχει six-phase dump στη συνομιλία. Μεγαλύτερες ερωτήσεις όπως «what is your version;» παίρνουν ακόμη μια σύντομη γραμμή συν αυτή την κάρτα."
  ],
  pl: [
    "Wpisz Ver, Vers lub Version, aby pokazać ten SMARTview. Polecenie ignoruje wielkość liter. Dłuższe pytania jak „what is your version?” nadal dostają odpowiedź tekstową plus tę kartę.",
    "Wpisz Ver, Vers lub Version, aby pokazać ten SMARTview. Polecenie ignoruje wielkość liter. Karta jest jedyną odpowiedzią — nie ma zrzutu six-phase w czacie. Dłuższe pytania jak „what is your version?” nadal dostają krótką linię plus tę kartę."
  ],
  ar: [
    "أدخل Ver أو Vers أو Version لعرض SMARTview هذا. الأمر لا يراعي حالة الأحرف. الأسئلة الأطول مثل “what is your version?” ما زالت تحصل على رد نصي بالإضافة إلى هذه البطاقة.",
    "أدخل Ver أو Vers أو Version لعرض SMARTview هذا. الأمر لا يراعي حالة الأحرف. البطاقة هي الإجابة الوحيدة — لا يوجد تفريغ six-phase في الدردشة. الأسئلة الأطول مثل “what is your version?” ما زالت تحصل على سطر نص قصير بالإضافة إلى هذه البطاقة."
  ]
};

const helpBodies = [
  [
    "In BOT DEE chat, type Ver, Vers, or Version (any capitalization, optional ?). A Version SMARTview card opens in the same bubble. It shows the real FLOQR package stamp, whether this turn used an AI model, and service status. Numbers in design pictures are examples — live values come from the app. Site Chrome follows your Appearance theme.",
    "In BOT DEE chat, type Ver, Vers, or Version (any capitalization, optional ?). The Version SMARTview card is the only answer — BOT DEE does not dump package, model, six-phase, or mock-integration text in the chat bubble. It shows the real FLOQR package stamp, whether this turn used an AI model, and service status. Numbers in design pictures are examples — live values come from the app. Site Chrome follows your Appearance theme."
  ],
  [
    "В чате BOT DEE введите Ver, Vers или Version (регистр не важен, ? по желанию). Карточка Version SMARTview открывается в том же пузыре. На ней реальный штамп пакета FLOQR, использовалась ли модель ИИ в этом ходе, и статус службы. Цифры на дизайн-макетах — примеры; живые значения берутся из приложения. Site Chrome следует теме Appearance.",
    "В чате BOT DEE введите Ver, Vers или Version (регистр не важен, ? по желанию). Карточка Version SMARTview — единственный ответ: BOT DEE не сбрасывает в чат пакет, модель, six-phase или список mock-интеграций. На ней реальный штамп пакета FLOQR, использовалась ли модель ИИ в этом ходе, и статус службы. Цифры на дизайн-макетах — примеры; живые значения берутся из приложения. Site Chrome следует теме Appearance."
  ],
  [
    "Typ in de BOT DEE-chat Ver, Vers of Version (hoofdletters maken niet uit, ? optioneel). Er opent een Version SMARTview-kaart in dezelfde bubble. Die toont de echte FLOQR-packagestempel, of deze beurt een AI-model gebruikte, en de servicestatus. Cijfers op ontwerpbeelden zijn voorbeelden — live waarden komen uit de app. Site Chrome volgt je Appearance-thema.",
    "Typ in de BOT DEE-chat Ver, Vers of Version (hoofdletters maken niet uit, ? optioneel). De Version SMARTview-kaart is het enige antwoord — BOT DEE dumpt geen package, model, six-phase of mock-integratietekst in de chatbubble. Die toont de echte FLOQR-packagestempel, of deze beurt een AI-model gebruikte, en de servicestatus. Cijfers op ontwerpbeelden zijn voorbeelden — live waarden komen uit de app. Site Chrome volgt je Appearance-thema."
  ],
  [
    "Dans le chat BOT DEE, saisissez Ver, Vers ou Version (casse indifférente, ? optionnel). Une carte Version SMARTview s’ouvre dans la même bulle. Elle affiche le vrai tampon de package FLOQR, si ce tour a utilisé un modèle d’IA, et l’état du service. Les chiffres des visuels de design sont des exemples — les valeurs live viennent de l’app. Site Chrome suit votre thème Appearance.",
    "Dans le chat BOT DEE, saisissez Ver, Vers ou Version (casse indifférente, ? optionnel). La carte Version SMARTview est la seule réponse — BOT DEE ne déverse pas le package, le modèle, le six-phase ni les intégrations mock dans la bulle. Elle affiche le vrai tampon de package FLOQR, si ce tour a utilisé un modèle d’IA, et l’état du service. Les chiffres des visuels de design sont des exemples — les valeurs live viennent de l’app. Site Chrome suit votre thème Appearance."
  ],
  [
    "Im BOT DEE-Chat tippen Sie Ver, Vers oder Version (Groß/Klein egal, optional ?). Eine Version-SMARTview-Karte öffnet sich in derselben Blase. Sie zeigt den echten FLOQR-Package-Stempel, ob dieser Zug ein KI-Modell genutzt hat, und den Dienststatus. Zahlen in Designbildern sind Beispiele — Live-Werte kommen aus der App. Site Chrome folgt Ihrem Appearance-Thema.",
    "Im BOT DEE-Chat tippen Sie Ver, Vers oder Version (Groß/Klein egal, optional ?). Die Version-SMARTview-Karte ist die einzige Antwort — BOT DEE dumppt kein Package, Modell, Six-Phase oder Mock-Integrationen in die Chatblase. Sie zeigt den echten FLOQR-Package-Stempel, ob dieser Zug ein KI-Modell genutzt hat, und den Dienststatus. Zahlen in Designbildern sind Beispiele — Live-Werte kommen aus der App. Site Chrome folgt Ihrem Appearance-Thema."
  ],
  [
    "En el chat de BOT DEE, escriba Ver, Vers o Version (mayúsculas da igual, ? opcional). Se abre una tarjeta Version SMARTview en la misma burbuja. Muestra el sello real del paquete FLOQR, si este turno usó un modelo de IA y el estado del servicio. Los números de las imágenes de diseño son ejemplos — los valores en vivo salen de la app. Site Chrome sigue su tema de Appearance.",
    "En el chat de BOT DEE, escriba Ver, Vers o Version (mayúsculas da igual, ? opcional). La tarjeta Version SMARTview es la única respuesta — BOT DEE no vuelca paquete, modelo, six-phase ni integraciones mock en la burbuja. Muestra el sello real del paquete FLOQR, si este turno usó un modelo de IA y el estado del servicio. Los números de las imágenes de diseño son ejemplos — los valores en vivo salen de la app. Site Chrome sigue su tema de Appearance."
  ],
  [
    "Nella chat BOT DEE, digita Ver, Vers o Version (maiuscole indifferenti, ? opzionale). Si apre una scheda Version SMARTview nella stessa bolla. Mostra il vero timbro del package FLOQR, se questo turno ha usato un modello IA e lo stato del servizio. I numeri nelle immagini di design sono esempi — i valori live arrivano dall’app. Site Chrome segue il tema Appearance.",
    "Nella chat BOT DEE, digita Ver, Vers o Version (maiuscole indifferenti, ? opzionale). La scheda Version SMARTview è l’unica risposta — BOT DEE non scarica package, modello, six-phase o integrazioni mock nella bolla. Mostra il vero timbro del package FLOQR, se questo turno ha usato un modello IA e lo stato del servizio. I numeri nelle immagini di design sono esempi — i valori live arrivano dall’app. Site Chrome segue il tema Appearance."
  ],
  [
    "No chat BOT DEE, digite Ver, Vers ou Version (maiúsculas não importam, ? opcional). Um cartão Version SMARTview abre no mesmo balão. Mostra o carimbo real do pacote FLOQR, se esta vez usou um modelo de IA e o estado do serviço. Números nas imagens de design são exemplos — os valores ao vivo vêm do app. Site Chrome segue o tema Appearance.",
    "No chat BOT DEE, digite Ver, Vers ou Version (maiúsculas não importam, ? opcional). O cartão Version SMARTview é a única resposta — BOT DEE não despeja package, modelo, six-phase nem integrações mock no balão. Mostra o carimbo real do pacote FLOQR, se esta vez usou um modelo de IA e o estado do serviço. Números nas imagens de design são exemplos — os valores ao vivo vêm do app. Site Chrome segue o tema Appearance."
  ],
  [
    "Στη συνομιλία BOT DEE πληκτρολογήστε Ver, Vers ή Version (κεφαλαία αδιάφορα, προαιρετικό ;). Ανοίγει κάρτα Version SMARTview στην ίδια φυσαλίδα. Δείχνει την πραγματική σφραγίδα πακέτου FLOQR, αν αυτός ο γύρος χρησιμοποίησε μοντέλο ΤΝ και την κατάσταση υπηρεσίας. Οι αριθμοί στις εικόνες σχεδίασης είναι παραδείγματα — οι ζωντανές τιμές έρχονται από την εφαρμογή. Το Site Chrome ακολουθεί το θέμα Appearance.",
    "Στη συνομιλία BOT DEE πληκτρολογήστε Ver, Vers ή Version (κεφαλαία αδιάφορα, προαιρετικό ;). Η κάρτα Version SMARTview είναι η μόνη απάντηση — η BOT DEE δεν ρίχνει package, μοντέλο, six-phase ή mock integrations στη φυσαλίδα. Δείχνει την πραγματική σφραγίδα πακέτου FLOQR, αν αυτός ο γύρος χρησιμοποίησε μοντέλο ΤΝ και την κατάσταση υπηρεσίας. Οι αριθμοί στις εικόνες σχεδίασης είναι παραδείγματα — οι ζωντανές τιμές έρχονται από την εφαρμογή. Το Site Chrome ακολουθεί το θέμα Appearance."
  ],
  [
    "W czacie BOT DEE wpisz Ver, Vers lub Version (wielkość liter nieważna, opcjonalny ?). Karta Version SMARTview otwiera się w tej samej dymku. Pokazuje prawdziwy stempel pakietu FLOQR, czy ta tura użyła modelu AI i status usługi. Liczby na obrazach projektu to przykłady — żywe wartości pochodzą z aplikacji. Site Chrome idzie za motywem Appearance.",
    "W czacie BOT DEE wpisz Ver, Vers lub Version (wielkość liter nieważna, opcjonalny ?). Karta Version SMARTview jest jedyną odpowiedzią — BOT DEE nie zrzuca pakietu, modelu, six-phase ani mock-integracji do dymka. Pokazuje prawdziwy stempel pakietu FLOQR, czy ta tura użyła modelu AI i status usługi. Liczby na obrazach projektu to przykłady — żywe wartości pochodzą z aplikacji. Site Chrome idzie za motywem Appearance."
  ],
  [
    "في دردشة BOT DEE اكتب Ver أو Vers أو Version (حجم الأحرف لا يهم، ? اختياري). تُفتح بطاقة Version SMARTview في نفس الفقاعة. تعرض ختم حزمة FLOQR الحقيقي، وما إذا استخدم هذا الدور نموذجاً للذكاء الاصطناعي، وحالة الخدمة. الأرقام في صور التصميم أمثلة — القيم الحية تأتي من التطبيق. يتبع Site Chrome مظهر Appearance.",
    "في دردشة BOT DEE اكتب Ver أو Vers أو Version (حجم الأحرف لا يهم، ? اختياري). بطاقة Version SMARTview هي الإجابة الوحيدة — لا تُفرّغ BOT DEE نص الحزمة أو النموذج أو six-phase أو التكاملات الوهمية في فقاعة الدردشة. تعرض ختم حزمة FLOQR الحقيقي، وما إذا استخدم هذا الدور نموذجاً للذكاء الاصطناعي، وحالة الخدمة. الأرقام في صور التصميم أمثلة — القيم الحية تأتي من التطبيق. يتبع Site Chrome مظهر Appearance."
  ]
];

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, got ${count}`);
  return src.replace(oldStr, newStr);
}

function run() {
  let i18n = fs.readFileSync(path.join(root, "floqr-i18n.js"), "utf8");
  for (const [lang, pair] of Object.entries(chromeHelpBody)) {
    i18n = replaceOnce(i18n, pair[0], pair[1], `chrome helpBody ${lang}`);
  }
  fs.writeFileSync(path.join(root, "floqr-i18n.js"), i18n);

  let help = fs.readFileSync(path.join(root, "floqr-i18n-help.js"), "utf8");
  for (const [i, pair] of helpBodies.slice(1).entries()) {
    help = replaceOnce(help, pair[0], pair[1], `help pack ${i}`);
  }
  fs.writeFileSync(path.join(root, "floqr-i18n-help.js"), help);

  let repo = fs.readFileSync(path.join(root, "botdee-help-repository.js"), "utf8");
  repo = replaceOnce(repo, helpBodies[0][0], helpBodies[0][1], "help repository en");
  fs.writeFileSync(path.join(root, "botdee-help-repository.js"), repo);

  let inject = fs.readFileSync(path.join(root, "scripts/inject-botdee-vs-i18n.js"), "utf8");
  for (const [lang, pair] of Object.entries(chromeHelpBody)) {
    if (inject.includes(pair[0])) inject = replaceOnce(inject, pair[0], pair[1], `inject chrome ${lang}`);
  }
  for (const [i, pair] of helpBodies.entries()) {
    if (inject.includes(pair[0])) inject = replaceOnce(inject, pair[0], pair[1], `inject help ${i}`);
  }
  fs.writeFileSync(path.join(root, "scripts/inject-botdee-vs-i18n.js"), inject);
  console.log("patched version card-only i18n");
}

run();
