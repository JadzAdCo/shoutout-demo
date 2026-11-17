#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

const STATUS_KEYS = {
  en: {operational: "Operational", degraded: "Degraded"},
  fr: {operational: "Opérationnel", degraded: "Dégradé"},
  de: {operational: "Betriebsbereit", degraded: "Eingeschränkt"},
  es: {operational: "Operativo", degraded: "Degradado"},
  nl: {operational: "Operationeel", degraded: "Verminderd"},
  ru: {operational: "Работает", degraded: "Ограничено"},
  it: {operational: "Operativo", degraded: "Degradato"},
  pt: {operational: "Operacional", degraded: "Degradado"},
  el: {operational: "Λειτουργικό", degraded: "Υποβαθμισμένο"},
  pl: {operational: "Działa", degraded: "Ograniczone"},
  ar: {operational: "تشغيلي", degraded: "متدهور"}
};

const HELP = {
  "help-botdee-version-smartview": {
    en: {
      title: "Version SMARTview",
      body: "In BOT DEE chat, type Ver, Vers, or Version (any capitalization, optional ?). The Version SMARTview card is the only answer — BOT DEE does not dump package, model, six-phase, or mock-integration text in the chat bubble. It shows the real FLOQR package stamp, the Gemini model id this deployment uses (the same model executeBotSession would call, even when this turn skipped generation), and a live service status from a probe of this request. Numbers in design pictures are examples — live values come from the app. Site Chrome follows your Appearance theme."
    },
    de: {
      title: "Version SMARTview",
      body: "Im BOT DEE-Chat tippen Sie Ver, Vers oder Version (Groß/Klein egal, optional ?). Die Version-SMARTview-Karte ist die einzige Antwort — BOT DEE dumppt kein Package, Modell, Six-Phase oder Mock-Integrationen in die Chatblase. Sie zeigt den echten FLOQR-Package-Stempel, die Gemini-Modell-ID dieses Deployments (dasselbe Modell, das executeBotSession nutzen würde, auch wenn dieser Zug nicht generiert), und einen Live-Dienststatus aus einer Prüfung dieser Anfrage. Zahlen in Designbildern sind Beispiele — Live-Werte kommen aus der App. Site Chrome folgt Ihrem Appearance-Thema."
    },
    fr: {
      title: "Version SMARTview",
      body: "Dans le chat BOT DEE, saisissez Ver, Vers ou Version (casse indifférente, ? optionnel). La carte Version SMARTview est la seule réponse — BOT DEE ne déverse pas le package, le modèle, le six-phase ni les intégrations mock dans la bulle. Elle affiche le vrai tampon de package FLOQR, l’identifiant du modèle Gemini de ce déploiement (le même que executeBotSession, même si ce tour n’a pas généré), et un état de service issu d’une sonde de cette requête. Les chiffres des visuels de design sont des exemples — les valeurs live viennent de l’app. Site Chrome suit votre thème Appearance."
    },
    es: {
      title: "Version SMARTview",
      body: "En el chat de BOT DEE, escriba Ver, Vers o Version (mayúsculas da igual, ? opcional). La tarjeta Version SMARTview es la única respuesta — BOT DEE no vuelca paquete, modelo, six-phase ni integraciones mock en la burbuja. Muestra el sello real del paquete FLOQR, el id del modelo Gemini de este despliegue (el mismo que usaría executeBotSession, aunque este turno no generara) y un estado de servicio de una sonda de esta petición. Los números de las imágenes de diseño son ejemplos — los valores en vivo salen de la app. Site Chrome sigue su tema de Appearance."
    },
    it: {
      title: "Version SMARTview",
      body: "Nella chat BOT DEE, digita Ver, Vers o Version (maiuscole indifferenti, ? opzionale). La scheda Version SMARTview è l’unica risposta — BOT DEE non scarica package, modello, six-phase o integrazioni mock nella bolla. Mostra il vero timbro del package FLOQR, l’id del modello Gemini di questo deployment (lo stesso che userebbe executeBotSession, anche se questo turno non ha generato) e uno stato del servizio da una sonda di questa richiesta. I numeri nelle immagini di design sono esempi — i valori live arrivano dall’app. Site Chrome segue il tema Appearance."
    },
    pt: {
      title: "Version SMARTview",
      body: "No chat BOT DEE, digite Ver, Vers ou Version (maiúsculas não importam, ? opcional). O cartão Version SMARTview é a única resposta — BOT DEE não despeja package, modelo, six-phase nem integrações mock no balão. Mostra o carimbo real do pacote FLOQR, o id do modelo Gemini deste deployment (o mesmo que executeBotSession usaria, mesmo quando esta vez não gerou) e um estado de serviço de uma sonda deste pedido. Números nas imagens de design são exemplos — os valores ao vivo vêm do app. Site Chrome segue o tema Appearance."
    },
    nl: {
      title: "Version SMARTview",
      body: "Typ in de BOT DEE-chat Ver, Vers of Version (hoofdletters maken niet uit, ? optioneel). De Version SMARTview-kaart is het enige antwoord — BOT DEE dumpt geen package, model, six-phase of mock-integratietekst in de chatbubble. Die toont de echte FLOQR-packagestempel, het Gemini-model-id van deze deployment (hetzelfde model dat executeBotSession zou aanroepen, ook als deze beurt niet genereerde) en een live servicestatus van een peiling van dit verzoek. Cijfers op ontwerpbeelden zijn voorbeelden — live waarden komen uit de app. Site Chrome volgt je Appearance-thema."
    },
    ru: {
      title: "Version SMARTview",
      body: "В чате BOT DEE введите Ver, Vers или Version (регистр не важен, ? по желанию). Карточка Version SMARTview — единственный ответ: BOT DEE не сбрасывает в чат пакет, модель, six-phase или список mock-интеграций. На ней реальный штамп пакета FLOQR, id модели Gemini этого развёртывания (та же, что вызвал бы executeBotSession, даже если этот ход не генерировал) и живой статус службы по проверке этого запроса. Цифры на дизайн-макетах — примеры; живые значения берутся из приложения. Site Chrome следует теме Appearance."
    },
    el: {
      title: "Version SMARTview",
      body: "Στη συνομιλία BOT DEE πληκτρολογήστε Ver, Vers ή Version (κεφαλαία αδιάφορα, προαιρετικό ;). Η κάρτα Version SMARTview είναι η μόνη απάντηση — η BOT DEE δεν ρίχνει package, μοντέλο, six-phase ή mock integrations στη φυσαλίδα. Δείχνει την πραγματική σφραγίδα πακέτου FLOQR, το id μοντέλου Gemini αυτού του deployment (το ίδιο που θα καλούσε το executeBotSession, ακόμα κι αν αυτός ο γύρος δεν παρήγαγε) και ζωντανή κατάσταση υπηρεσίας από έλεγχο αυτού του αιτήματος. Οι αριθμοί στις εικόνες σχεδίασης είναι παραδείγματα — οι ζωντανές τιμές έρχονται από την εφαρμογή. Το Site Chrome ακολουθεί το θέμα Appearance."
    },
    pl: {
      title: "Version SMARTview",
      body: "W czacie BOT DEE wpisz Ver, Vers lub Version (wielkość liter nieważna, opcjonalny ?). Karta Version SMARTview jest jedyną odpowiedzią — BOT DEE nie zrzuca pakietu, modelu, six-phase ani mock-integracji do dymka. Pokazuje prawdziwy stempel pakietu FLOQR, id modelu Gemini tego wdrożenia (ten sam, którego użyłby executeBotSession, nawet gdy ta tura nie generowała) oraz żywy status usługi z sondy tego żądania. Liczby na obrazach projektu to przykłady — żywe wartości pochodzą z aplikacji. Site Chrome idzie za motywem Appearance."
    },
    ar: {
      title: "Version SMARTview",
      body: "في دردشة BOT DEE اكتب Ver أو Vers أو Version (حجم الأحرف لا يهم، ? اختياري). بطاقة Version SMARTview هي الإجابة الوحيدة — لا تُفرّغ BOT DEE نص الحزمة أو النموذج أو six-phase أو التكاملات الوهمية في فقاعة الدردشة. تعرض ختم حزمة FLOQR الحقيقي، ومعرّف نموذج Gemini لهذا النشر (نفس النموذج الذي يستدعيه executeBotSession حتى إن تخطّى هذا الدور التوليد)، وحالة خدمة حيّة من فحص هذا الطلب. الأرقام في صور التصميم أمثلة — القيم الحية تأتي من التطبيق. يتبع Site Chrome مظهر Appearance."
    }
  },
  "help-botdee-version-smartview-status": {
    en: {
      title: "Version SMARTview status is a live probe",
      body: "Service status is probed on this Version request: Functions and package reachable with Gemini configured → Operational; Functions and package up but Gemini not configured → Degraded; Functions not in this request → Unavailable. It is never a static Not checked label. AI model shows the configured Gemini model id for this deployment even when this turn did not generate. Frontend and backend package stamps can differ; both are labeled. Master Admin may see extra diagnostics after Technical Details — patrons do not."
    },
    de: {
      title: "Version-SMARTview-Status ist eine Live-Prüfung",
      body: "Der Dienststatus wird bei dieser Version-Anfrage geprüft: Functions und Package erreichbar und Gemini konfiguriert → Betriebsbereit; Functions und Package da, Gemini nicht konfiguriert → Eingeschränkt; Functions nicht in dieser Anfrage → Nicht verfügbar. Nie ein statisches Nicht geprüft. Das KI-Modell zeigt die konfigurierte Gemini-Modell-ID dieses Deployments, auch wenn dieser Zug nicht generiert. Frontend- und Backend-Stempel können sich unterscheiden; beide sind beschriftet. Master Admin sieht extra Diagnosen unter Technische Details — Gäste nicht."
    },
    fr: {
      title: "L’état Version SMARTview est une sonde live",
      body: "L’état du service est sondé sur cette requête Version : Functions et package joignables avec Gemini configuré → Opérationnel ; Functions et package OK mais Gemini non configuré → Dégradé ; Functions absentes de cette requête → Indisponible. Jamais un libellé statique Non vérifié. Le modèle d’IA affiche l’identifiant Gemini configuré pour ce déploiement même si ce tour n’a pas généré. Les tampons frontend et backend peuvent différer ; les deux sont étiquetés. Master Admin peut voir des diagnostics sous Détails techniques — pas les patrons."
    },
    es: {
      title: "El estado de Version SMARTview es una sonda en vivo",
      body: "El estado del servicio se sondea en esta petición Version: Functions y paquete alcanzables con Gemini configurado → Operativo; Functions y paquete bien pero Gemini no configurado → Degradado; Functions no en esta petición → No disponible. Nunca una etiqueta estática Sin comprobar. El modelo de IA muestra el id de Gemini configurado de este despliegue aunque este turno no genere. Los sellos de frontend y backend pueden diferir; ambos se etiquetan. Master Admin puede ver diagnósticos extra en Detalles técnicos — los patrons no."
    },
    it: {
      title: "Lo stato Version SMARTview è una sonda live",
      body: "Lo stato del servizio è sondato su questa richiesta Version: Functions e package raggiungibili con Gemini configurato → Operativo; Functions e package ok ma Gemini non configurato → Degradato; Functions assenti da questa richiesta → Non disponibile. Mai un’etichetta statica Non verificato. Il modello IA mostra l’id Gemini configurato di questo deployment anche se questo turno non ha generato. I timbri frontend e backend possono differire; entrambi sono etichettati. Master Admin può vedere diagnostica extra in Dettagli tecnici — i patron no."
    },
    pt: {
      title: "O estado do Version SMARTview é uma sonda ao vivo",
      body: "O estado do serviço é sondado neste pedido Version: Functions e pacote alcançáveis com Gemini configurado → Operacional; Functions e pacote ok mas Gemini não configurado → Degradado; Functions fora deste pedido → Indisponível. Nunca um rótulo estático Não verificado. O modelo de IA mostra o id Gemini configurado deste deployment mesmo quando esta vez não gerou. Os carimbos de frontend e backend podem diferir; ambos são rotulados. Master Admin pode ver diagnósticos extra em Detalhes técnicos — patrons não."
    },
    nl: {
      title: "Version SMARTview-status is een live peiling",
      body: "Servicestatus wordt bij dit Version-verzoek gepeild: Functions en package bereikbaar met Gemini geconfigureerd → Operationeel; Functions en package oké maar Gemini niet geconfigureerd → Verminderd; Functions niet in dit verzoek → Niet beschikbaar. Nooit een statisch Niet gecontroleerd. Het AI-model toont het geconfigureerde Gemini-model-id van deze deployment ook als deze beurt niet genereerde. Frontend- en backendstempels kunnen verschillen; beide zijn gelabeld. Master Admin kan extra diagnostiek zien onder Technische details — patrons niet."
    },
    ru: {
      title: "Статус Version SMARTview — живая проверка",
      body: "Состояние службы проверяется на этом запросе Version: Functions и пакет доступны и Gemini настроен → Работает; Functions и пакет есть, Gemini не настроен → Ограничено; Functions нет в этом запросе → Недоступно. Никогда не статическая метка Не проверено. Модель ИИ показывает настроенный id Gemini этого развёртывания, даже если этот ход не генерировал. Штампы фронтенда и бэкенда могут различаться; оба подписаны. Master Admin видит доп. диагностику в технических сведениях — гости нет."
    },
    el: {
      title: "Η κατάσταση Version SMARTview είναι ζωντανός έλεγχος",
      body: "Η κατάσταση υπηρεσίας ελέγχεται σε αυτό το αίτημα Version: Functions και πακέτο προσβάσιμα με ρυθμισμένο Gemini → Λειτουργικό; Functions και πακέτο εντάξει αλλά Gemini μη ρυθμισμένο → Υποβαθμισμένο; Functions εκτός αυτού του αιτήματος → Μη διαθέσιμο. Ποτέ στατική ετικέτα Δεν ελέγχθηκε. Το μοντέλο ΤΝ δείχνει το ρυθμισμένο id Gemini αυτού του deployment ακόμα κι αν αυτός ο γύρος δεν παρήγαγε. Τα σφραγίσματα frontend και backend μπορεί να διαφέρουν· και τα δύο έχουν ετικέτα. Ο Master Admin μπορεί να δει επιπλέον διάγνωση στις Τεχνικές λεπτομέρειες — οι patrons όχι."
    },
    pl: {
      title: "Status Version SMARTview to żywa sonda",
      body: "Status usługi jest sondowany przy tym żądaniu Version: Functions i pakiet osiągalne z skonfigurowanym Gemini → Działa; Functions i pakiet ok, ale Gemini nieskonfigurowane → Ograniczone; Functions poza tym żądaniem → Niedostępne. Nigdy statyczna etykieta Nie sprawdzono. Model AI pokazuje skonfigurowane id Gemini tego wdrożenia nawet gdy ta tura nie generowała. Stemple frontendu i backendu mogą się różnić; oba są opisane. Master Admin może zobaczyć dodatkową diagnostykę w Szczegółach technicznych — patroni nie."
    },
    ar: {
      title: "حالة Version SMARTview فحص حي",
      body: "تُفحص حالة الخدمة في طلب Version هذا: Functions والحزمة قابلان للوصول وGemini مضبوط → تشغيلي؛ Functions والحزمة جاهزان لكن Gemini غير مضبوط → متدهور؛ Functions ليست في هذا الطلب → غير متاح. ليست أبداً تسمية ثابتة «لم يُتحقق». يعرض نموذج الذكاء الاصطناعي معرّف Gemini المضبوط لهذا النشر حتى إن لم يولّد هذا الدور. يمكن أن يختلف ختم الواجهة عن الخلفية؛ كلاهما مُسمّى. قد يرى Master Admin تشخيصاً إضافياً تحت التفاصيل التقنية — الضيوف لا."
    }
  }
};

function jsString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function insertChromeKeys(src) {
  let count = 0;
  const langOrder = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];
  const next = src.replace(
    /("botdee\.vs\.statusUnavailable":\s*")([^"]*)(")/g,
    (full, pre, value, post, offset) => {
      const idx = count;
      count += 1;
      const window = src.slice(offset, offset + 280);
      if (window.includes("botdee.vs.statusOperational")) return full;
      const lang = langOrder[idx] || "en";
      const pack = STATUS_KEYS[lang];
      return `${pre}${value}${post},\n      "botdee.vs.statusOperational": ${JSON.stringify(pack.operational)},\n      "botdee.vs.statusDegraded": ${JSON.stringify(pack.degraded)}`;
    }
  );
  if (count !== 11) throw new Error(`expected 11 chrome packs, got ${count}`);
  return next;
}

function replaceHelpJs(src) {
  const langs = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];
  let out = src;
  Object.keys(HELP).forEach(id => {
    const re = new RegExp(
      `("${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}":\\s*\\{\\s*title:\\s*")([^"]*)(",\\s*body:\\s*")([\\s\\S]*?)("\\s*\\})`,
      "g"
    );
    let idx = 0;
    out = out.replace(re, (full, a, _title, b, _body, c) => {
      const lang = langs[idx];
      idx += 1;
      if (!lang) throw new Error(`extra help pack for ${id}`);
      const row = HELP[id][lang];
      return `${a}${jsString(row.title)}${b}${jsString(row.body)}${c}`;
    });
    if (idx !== 10) throw new Error(`${id} expected 10 locales, got ${idx}`);
  });
  return out;
}

function replaceHelpRepo(src) {
  Object.entries(HELP).forEach(([id, byLang]) => {
    const row = byLang.en;
    const re = new RegExp(
      `(id:\\s*"${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}",\\s*title:\\s*")([^"]*)(",\\s*body:\\s*")([\\s\\S]*?)(")`
    );
    if (!re.test(src)) throw new Error(`repo missing ${id}`);
    src = src.replace(re, (_full, a, _t, b, _body, c) => {
      return `${a}${jsString(row.title)}${b}${jsString(row.body)}${c}`;
    });
  });
  return src;
}

const i18nFile = path.join(root, "floqr-i18n.js");
fs.writeFileSync(i18nFile, insertChromeKeys(fs.readFileSync(i18nFile, "utf8")));
console.log("chrome keys added");

const helpFile = path.join(root, "floqr-i18n-help.js");
fs.writeFileSync(helpFile, replaceHelpJs(fs.readFileSync(helpFile, "utf8")));
console.log("help locales updated");

const repoFile = path.join(root, "botdee-help-repository.js");
fs.writeFileSync(repoFile, replaceHelpRepo(fs.readFileSync(repoFile, "utf8")));
console.log("help repository updated");
