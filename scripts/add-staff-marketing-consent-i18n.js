#!/usr/bin/env node
/* Staff marketing consent — 20 chrome keys (11 packs) + help-staff-marketing-consent (repository, _help-en.json, 10 help packs).
   Reads each file fresh and writes it immediately (other agents may edit the same files). */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const at = file => path.join(root, file);
const read = file => fs.readFileSync(at(file), "utf8");
const write = (file, src) => fs.writeFileSync(at(file), src);
const eolOf = src => (src.includes("\r\n") ? "\r\n" : "\n");
const q = s => JSON.stringify(s);

const consent = require(at("floqr-staff-marketing-consent.js"));
const KEYS = ["title", "p1", "p2", "p3", "p4", "checkbox", "required", "manageTitle", "statusGiven", "statusWithdrawn",
  "statusNone", "withdrawBtn", "giveBtn", "withdrawConfirm", "withdrawnDone", "givenDone", "saveFailed",
  "adminGiven", "adminWithdrawn", "adminNone"];

const T = {
  en: KEYS.map(key => consent.EN[`staffConsent.${key}`]),
  fr: [
    "Utilisation marketing de votre nom et de vos photos",
    "Lorsque vous rejoignez l’équipe d’un club, d’un lounge, d’un lieu ou d’un événement sur FLOQR, vous autorisez chaque lieu ou organisateur d’événements que vous rejoignez, ainsi que ses administrateurs et responsables, à utiliser votre nom de profil FLOQR, votre rôle et les photos et vidéos que vous avez publiées ou sélectionnées sur FLOQR pour promouvoir ce lieu et ses événements.",
    "Cela couvre leurs sites web, flyers et affiches, ainsi que leurs campagnes sur les réseaux sociaux Instagram, Facebook, TikTok, YouTube et plateformes similaires. Tant que ce consentement est actif, ils n’ont pas besoin de vous redemander votre accord pour chaque nouvelle utilisation. Cette autorisation est non exclusive et gratuite : vous conservez vos droits sur vos propres photos et vidéos, et aucune rémunération ne vous est due.",
    "Ils ne peuvent pas publier vos coordonnées privées, comme votre numéro de téléphone ou votre adresse e-mail.",
    "Vous pouvez retirer ce consentement à tout moment dans Mon profil. Le retrait met fin à toute nouvelle utilisation marketing. Les supports déjà imprimés ou publiés avant votre retrait n’ont pas à être retirés.",
    "J’accepte que les lieux et organisateurs d’événements que je rejoins utilisent mon nom, mon rôle et mes photos et vidéos publiées à des fins marketing, comme décrit ci-dessus.",
    "Cochez la case de consentement marketing pour continuer.",
    "Consentement marketing",
    "Actif depuis le {date}. Les lieux et équipes d’événements que vous rejoignez peuvent utiliser votre nom, votre rôle et vos photos et vidéos publiées à des fins marketing.",
    "Retiré le {date}. Les lieux ne peuvent pas lancer de nouveaux supports marketing avec votre nom ou vos photos. Votre accord vous sera redemandé avant de rejoindre un autre lieu ou une autre équipe d’événement.",
    "Pas encore donné. Il vous sera demandé lorsque vous rejoindrez un lieu ou une équipe d’événement.",
    "Retirer le consentement marketing",
    "Donner le consentement marketing",
    "Retirer votre consentement marketing ? Les lieux doivent cesser de lancer de nouveaux supports marketing avec votre nom ou vos photos. Les supports déjà imprimés ou publiés n’ont pas à être retirés.",
    "Consentement marketing retiré.",
    "Consentement marketing enregistré.",
    "Votre consentement n’a pas pu être enregistré. Réessayez.",
    "Consentement marketing : donné le {date}",
    "Consentement marketing : retiré le {date}",
    "Consentement marketing : non enregistré"
  ],
  de: [
    "Marketing-Nutzung deines Namens und deiner Fotos",
    "Wenn du auf FLOQR dem Team eines Clubs, einer Lounge, einer Location oder eines Events beitrittst, erlaubst du jeder Location und jedem Veranstalter, dem du beitrittst, sowie deren Admins und Managern, deinen FLOQR-Profilnamen, deine Rolle und die Fotos und Videos, die du auf FLOQR veröffentlicht oder ausgewählt hast, zur Werbung für diese Location und ihre Events zu nutzen.",
    "Das umfasst ihre Websites, Flyer und Plakate sowie Social-Media-Kampagnen auf Instagram, Facebook, TikTok, YouTube und ähnlichen Plattformen. Solange diese Einwilligung aktiv ist, müssen sie dich nicht für jede neue Nutzung erneut fragen. Die Erlaubnis ist nicht exklusiv und unentgeltlich: Du behältst die Rechte an deinen eigenen Fotos und Videos, und dir steht keine Vergütung zu.",
    "Deine privaten Kontaktdaten wie Telefonnummer oder E-Mail-Adresse dürfen sie nicht veröffentlichen.",
    "Du kannst diese Einwilligung jederzeit in Mein Profil widerrufen. Der Widerruf beendet jede neue Marketing-Nutzung. Materialien, die vor deinem Widerruf bereits gedruckt oder gepostet wurden, müssen nicht zurückgerufen werden.",
    "Ich bin einverstanden, dass die Locations und Veranstalter, denen ich beitrete, meinen Namen, meine Rolle und meine veröffentlichten Fotos und Videos wie oben beschrieben für Marketing nutzen.",
    "Hake das Feld zur Marketing-Einwilligung an, um fortzufahren.",
    "Marketing-Einwilligung",
    "Aktiv seit {date}. Die Locations und Event-Teams, denen du beitrittst, dürfen deinen Namen, deine Rolle und deine veröffentlichten Fotos und Videos für Marketing nutzen.",
    "Widerrufen am {date}. Locations dürfen kein neues Marketing mit deinem Namen oder deinen Fotos beginnen. Du wirst erneut gefragt, bevor du einer weiteren Location oder einem Event-Team beitrittst.",
    "Noch nicht erteilt. Du wirst gefragt, wenn du einer Location oder einem Event-Team beitrittst.",
    "Marketing-Einwilligung widerrufen",
    "Marketing-Einwilligung erteilen",
    "Marketing-Einwilligung widerrufen? Locations müssen aufhören, neues Marketing mit deinem Namen oder deinen Fotos zu beginnen. Bereits gedruckte oder gepostete Materialien müssen nicht zurückgerufen werden.",
    "Marketing-Einwilligung wurde widerrufen.",
    "Marketing-Einwilligung gespeichert.",
    "Deine Einwilligung konnte nicht gespeichert werden. Bitte versuche es erneut.",
    "Marketing-Einwilligung: erteilt am {date}",
    "Marketing-Einwilligung: widerrufen am {date}",
    "Marketing-Einwilligung: nicht erfasst"
  ],
  es: [
    "Uso de tu nombre y tus fotos en marketing",
    "Cuando te unes al equipo de un club, lounge, local o evento en FLOQR, das permiso a cada local u organizador de eventos al que te unes, y a sus administradores y gerentes, para usar tu nombre de perfil de FLOQR, tu rol y las fotos y videos que has publicado o seleccionado en FLOQR para promocionar ese local y sus eventos.",
    "Esto incluye sus sitios web, flyers y carteles, y campañas en redes sociales como Instagram, Facebook, TikTok, YouTube y plataformas similares. Mientras este consentimiento esté activo, no necesitan volver a pedirte permiso para cada nuevo uso. El permiso es no exclusivo y gratuito: conservas los derechos sobre tus propias fotos y videos, y no se te debe ningún pago.",
    "No pueden publicar tus datos de contacto privados, como tu número de teléfono o tu correo electrónico.",
    "Puedes retirar este consentimiento en cualquier momento en Mi perfil. Al retirarlo se detiene todo nuevo uso de marketing. Los materiales ya impresos o publicados antes de retirarlo no tienen que retirarse.",
    "Acepto que los locales y organizadores de eventos a los que me uno usen mi nombre, mi rol y mis fotos y videos publicados para marketing, como se describe arriba.",
    "Marca la casilla de consentimiento de marketing para continuar.",
    "Consentimiento de marketing",
    "Activo desde el {date}. Los locales y equipos de eventos a los que te unes pueden usar tu nombre, tu rol y tus fotos y videos publicados para marketing.",
    "Retirado el {date}. Los locales no pueden iniciar nuevo marketing con tu nombre o tus fotos. Se te volverá a preguntar antes de unirte a otro local o equipo de eventos.",
    "Aún no otorgado. Se te preguntará cuando te unas a un local o equipo de eventos.",
    "Retirar consentimiento de marketing",
    "Dar consentimiento de marketing",
    "¿Retirar tu consentimiento de marketing? Los locales deben dejar de iniciar nuevo marketing con tu nombre o tus fotos. Los materiales ya impresos o publicados no tienen que retirarse.",
    "Consentimiento de marketing retirado.",
    "Consentimiento de marketing guardado.",
    "No se pudo guardar tu consentimiento. Inténtalo de nuevo.",
    "Consentimiento de marketing: otorgado el {date}",
    "Consentimiento de marketing: retirado el {date}",
    "Consentimiento de marketing: no registrado"
  ],
  nl: [
    "Marketinggebruik van je naam en foto’s",
    "Wanneer je op FLOQR lid wordt van het team van een club, lounge, locatie of evenement, geef je elke locatie of evenementorganisator waarbij je aansluit, en hun beheerders en managers, toestemming om je FLOQR-profielnaam, je rol en de foto’s en video’s die je op FLOQR hebt gepubliceerd of geselecteerd te gebruiken om die locatie en haar evenementen te promoten.",
    "Dit geldt voor hun websites, flyers en posters, en socialemediacampagnes op Instagram, Facebook, TikTok, YouTube en vergelijkbare platforms. Zolang deze toestemming actief is, hoeven ze je niet voor elk nieuw gebruik opnieuw te vragen. De toestemming is niet-exclusief en kosteloos: je behoudt de rechten op je eigen foto’s en video’s, en je hebt geen recht op een vergoeding.",
    "Ze mogen je privécontactgegevens, zoals je telefoonnummer of e-mailadres, niet publiceren.",
    "Je kunt deze toestemming op elk moment intrekken in Mijn profiel. Intrekken stopt elk nieuw marketinggebruik. Materiaal dat al gedrukt of geplaatst was voordat je introk, hoeft niet te worden teruggehaald.",
    "Ik ga ermee akkoord dat de locaties en evenementorganisatoren waarbij ik aansluit mijn naam, rol en gepubliceerde foto’s en video’s gebruiken voor marketing zoals hierboven beschreven.",
    "Vink het vakje voor marketingtoestemming aan om door te gaan.",
    "Marketingtoestemming",
    "Actief sinds {date}. De locaties en evenementteams waarbij je aansluit mogen je naam, rol en gepubliceerde foto’s en video’s gebruiken voor marketing.",
    "Ingetrokken op {date}. Locaties mogen geen nieuwe marketing met je naam of foto’s starten. Je wordt opnieuw gevraagd voordat je bij een andere locatie of een ander evenementteam aansluit.",
    "Nog niet gegeven. Je wordt gevraagd wanneer je bij een locatie of evenementteam aansluit.",
    "Marketingtoestemming intrekken",
    "Marketingtoestemming geven",
    "Je marketingtoestemming intrekken? Locaties moeten stoppen met het starten van nieuwe marketing met je naam of foto’s. Materiaal dat al gedrukt of geplaatst is, hoeft niet te worden teruggehaald.",
    "Marketingtoestemming ingetrokken.",
    "Marketingtoestemming opgeslagen.",
    "Je toestemming kon niet worden opgeslagen. Probeer het opnieuw.",
    "Marketingtoestemming: gegeven op {date}",
    "Marketingtoestemming: ingetrokken op {date}",
    "Marketingtoestemming: niet geregistreerd"
  ],
  ru: [
    "Использование вашего имени и фото в маркетинге",
    "Присоединяясь на FLOQR к команде клуба, лаунжа, заведения или мероприятия, вы разрешаете каждому заведению или организатору мероприятий, к которому присоединяетесь, а также его администраторам и менеджерам использовать ваше имя в профиле FLOQR, вашу роль и фото и видео, которые вы опубликовали или выбрали на FLOQR, для продвижения этого заведения и его мероприятий.",
    "Это касается их сайтов, флаеров и плакатов, а также кампаний в социальных сетях Instagram, Facebook, TikTok, YouTube и на похожих платформах. Пока это согласие действует, им не нужно заново спрашивать вас о каждом новом использовании. Разрешение неисключительное и безвозмездное: права на ваши фото и видео остаются за вами, и вознаграждение вам не полагается.",
    "Они не могут публиковать ваши личные контактные данные, например номер телефона или адрес электронной почты.",
    "Вы можете в любой момент отозвать это согласие в разделе «Мой профиль». Отзыв прекращает любое новое использование в маркетинге. Материалы, уже напечатанные или опубликованные до отзыва, изымать не обязательно.",
    "Я согласен(на), чтобы заведения и организаторы мероприятий, к которым я присоединяюсь, использовали моё имя, роль и опубликованные фото и видео в маркетинге, как описано выше.",
    "Отметьте согласие на маркетинг, чтобы продолжить.",
    "Согласие на маркетинг",
    "Действует с {date}. Заведения и команды мероприятий, к которым вы присоединяетесь, могут использовать ваше имя, роль и опубликованные фото и видео в маркетинге.",
    "Отозвано {date}. Заведения не могут начинать новый маркетинг с вашим именем или фото. Перед присоединением к другому заведению или команде мероприятия вас спросят снова.",
    "Пока не дано. Вас спросят, когда вы присоединитесь к заведению или команде мероприятия.",
    "Отозвать согласие на маркетинг",
    "Дать согласие на маркетинг",
    "Отозвать согласие на маркетинг? Заведения должны прекратить запуск нового маркетинга с вашим именем или фото. Уже напечатанные или опубликованные материалы изымать не обязательно.",
    "Согласие на маркетинг отозвано.",
    "Согласие на маркетинг сохранено.",
    "Не удалось сохранить согласие. Попробуйте ещё раз.",
    "Согласие на маркетинг: дано {date}",
    "Согласие на маркетинг: отозвано {date}",
    "Согласие на маркетинг: не записано"
  ],
  it: [
    "Uso del tuo nome e delle tue foto nel marketing",
    "Quando entri nel team di un club, lounge, locale o evento su FLOQR, autorizzi ogni locale o organizzatore di eventi a cui ti unisci, e i suoi amministratori e manager, a usare il tuo nome del profilo FLOQR, il tuo ruolo e le foto e i video che hai pubblicato o selezionato su FLOQR per promuovere quel locale e i suoi eventi.",
    "Questo include i loro siti web, volantini e manifesti e le campagne sui social media Instagram, Facebook, TikTok, YouTube e piattaforme simili. Finché questo consenso è attivo, non devono chiederti di nuovo il permesso per ogni nuovo utilizzo. L’autorizzazione è non esclusiva e gratuita: mantieni i diritti sulle tue foto e sui tuoi video e non ti è dovuto alcun compenso.",
    "Non possono pubblicare i tuoi dati di contatto privati, come il numero di telefono o l’indirizzo email.",
    "Puoi revocare questo consenso in qualsiasi momento in Il mio profilo. La revoca interrompe ogni nuovo utilizzo di marketing. I materiali già stampati o pubblicati prima della revoca non devono essere ritirati.",
    "Accetto che i locali e gli organizzatori di eventi a cui mi unisco usino il mio nome, il mio ruolo e le mie foto e i miei video pubblicati per il marketing, come descritto sopra.",
    "Seleziona la casella del consenso marketing per continuare.",
    "Consenso marketing",
    "Attivo dal {date}. I locali e i team di eventi a cui ti unisci possono usare il tuo nome, il tuo ruolo e le tue foto e i tuoi video pubblicati per il marketing.",
    "Revocato il {date}. I locali non possono avviare nuovo marketing con il tuo nome o le tue foto. Ti verrà chiesto di nuovo prima di unirti a un altro locale o team di eventi.",
    "Non ancora dato. Ti verrà chiesto quando ti unirai a un locale o a un team di eventi.",
    "Revoca il consenso marketing",
    "Dai il consenso marketing",
    "Revocare il tuo consenso marketing? I locali devono smettere di avviare nuovo marketing con il tuo nome o le tue foto. I materiali già stampati o pubblicati non devono essere ritirati.",
    "Consenso marketing revocato.",
    "Consenso marketing salvato.",
    "Non è stato possibile salvare il consenso. Riprova.",
    "Consenso marketing: dato il {date}",
    "Consenso marketing: revocato il {date}",
    "Consenso marketing: non registrato"
  ],
  pt: [
    "Uso do seu nome e das suas fotos em marketing",
    "Quando você entra na equipe de um clube, lounge, casa ou evento no FLOQR, você autoriza cada casa ou organizador de eventos em que entrar, e seus administradores e gerentes, a usar seu nome de perfil do FLOQR, sua função e as fotos e vídeos que você publicou ou selecionou no FLOQR para divulgar essa casa e seus eventos.",
    "Isso inclui sites, flyers e cartazes, e campanhas em redes sociais no Instagram, Facebook, TikTok, YouTube e plataformas semelhantes. Enquanto este consentimento estiver ativo, eles não precisam pedir sua permissão novamente para cada novo uso. A autorização é não exclusiva e gratuita: você mantém os direitos sobre suas próprias fotos e vídeos, e nenhum pagamento é devido a você.",
    "Eles não podem publicar seus dados de contato privados, como seu número de telefone ou e-mail.",
    "Você pode retirar este consentimento a qualquer momento em Meu perfil. A retirada interrompe qualquer novo uso em marketing. Materiais já impressos ou publicados antes da retirada não precisam ser recolhidos.",
    "Concordo que as casas e organizadores de eventos em que eu entrar usem meu nome, minha função e minhas fotos e vídeos publicados para marketing, conforme descrito acima.",
    "Marque a caixa de consentimento de marketing para continuar.",
    "Consentimento de marketing",
    "Ativo desde {date}. As casas e equipes de eventos em que você entrar podem usar seu nome, sua função e suas fotos e vídeos publicados para marketing.",
    "Retirado em {date}. As casas não podem iniciar novo marketing com seu nome ou suas fotos. Você será perguntado novamente antes de entrar em outra casa ou equipe de eventos.",
    "Ainda não dado. Você será perguntado quando entrar em uma casa ou equipe de eventos.",
    "Retirar consentimento de marketing",
    "Dar consentimento de marketing",
    "Retirar seu consentimento de marketing? As casas devem parar de iniciar novo marketing com seu nome ou suas fotos. Materiais já impressos ou publicados não precisam ser recolhidos.",
    "Consentimento de marketing retirado.",
    "Consentimento de marketing salvo.",
    "Não foi possível salvar seu consentimento. Tente novamente.",
    "Consentimento de marketing: dado em {date}",
    "Consentimento de marketing: retirado em {date}",
    "Consentimento de marketing: não registrado"
  ],
  el: [
    "Χρήση του ονόματος και των φωτογραφιών σας στο μάρκετινγκ",
    "Όταν εντάσσεστε στην ομάδα ενός κλαμπ, lounge, χώρου ή εκδήλωσης στο FLOQR, δίνετε σε κάθε χώρο ή διοργανωτή εκδηλώσεων στον οποίο εντάσσεστε, καθώς και στους διαχειριστές και τους υπευθύνους του, την άδεια να χρησιμοποιούν το όνομα του προφίλ σας στο FLOQR, τον ρόλο σας και τις φωτογραφίες και τα βίντεο που έχετε δημοσιεύσει ή επιλέξει στο FLOQR για την προώθηση του χώρου και των εκδηλώσεών του.",
    "Αυτό καλύπτει τους ιστότοπούς τους, φυλλάδια και αφίσες, καθώς και καμπάνιες στα μέσα κοινωνικής δικτύωσης Instagram, Facebook, TikTok, YouTube και σε παρόμοιες πλατφόρμες. Όσο αυτή η συγκατάθεση είναι ενεργή, δεν χρειάζεται να σας ρωτούν ξανά για κάθε νέα χρήση. Η άδεια είναι μη αποκλειστική και δωρεάν: διατηρείτε τα δικαιώματα στις δικές σας φωτογραφίες και βίντεο, και δεν σας οφείλεται καμία αμοιβή.",
    "Δεν επιτρέπεται να δημοσιεύουν τα ιδιωτικά στοιχεία επικοινωνίας σας, όπως τον αριθμό τηλεφώνου ή τη διεύθυνση email σας.",
    "Μπορείτε να ανακαλέσετε αυτή τη συγκατάθεση ανά πάσα στιγμή από την ενότητα «Το προφίλ μου». Η ανάκληση σταματά κάθε νέα χρήση για μάρκετινγκ. Υλικό που έχει ήδη τυπωθεί ή δημοσιευτεί πριν από την ανάκληση δεν χρειάζεται να αποσυρθεί.",
    "Συμφωνώ οι χώροι και οι διοργανωτές εκδηλώσεων στους οποίους εντάσσομαι να χρησιμοποιούν το όνομά μου, τον ρόλο μου και τις δημοσιευμένες φωτογραφίες και βίντεό μου για μάρκετινγκ, όπως περιγράφεται παραπάνω.",
    "Επιλέξτε το πλαίσιο συγκατάθεσης μάρκετινγκ για να συνεχίσετε.",
    "Συγκατάθεση μάρκετινγκ",
    "Ενεργή από {date}. Οι χώροι και οι ομάδες εκδηλώσεων στις οποίες εντάσσεστε μπορούν να χρησιμοποιούν το όνομά σας, τον ρόλο σας και τις δημοσιευμένες φωτογραφίες και βίντεό σας για μάρκετινγκ.",
    "Ανακλήθηκε στις {date}. Οι χώροι δεν μπορούν να ξεκινήσουν νέο μάρκετινγκ με το όνομα ή τις φωτογραφίες σας. Θα ερωτηθείτε ξανά πριν ενταχθείτε σε άλλον χώρο ή ομάδα εκδήλωσης.",
    "Δεν έχει δοθεί ακόμη. Θα ερωτηθείτε όταν ενταχθείτε σε χώρο ή ομάδα εκδήλωσης.",
    "Ανάκληση συγκατάθεσης μάρκετινγκ",
    "Παροχή συγκατάθεσης μάρκετινγκ",
    "Ανάκληση της συγκατάθεσης μάρκετινγκ; Οι χώροι πρέπει να σταματήσουν να ξεκινούν νέο μάρκετινγκ με το όνομα ή τις φωτογραφίες σας. Υλικό που έχει ήδη τυπωθεί ή δημοσιευτεί δεν χρειάζεται να αποσυρθεί.",
    "Η συγκατάθεση μάρκετινγκ ανακλήθηκε.",
    "Η συγκατάθεση μάρκετινγκ αποθηκεύτηκε.",
    "Δεν ήταν δυνατή η αποθήκευση της συγκατάθεσής σας. Δοκιμάστε ξανά.",
    "Συγκατάθεση μάρκετινγκ: δόθηκε στις {date}",
    "Συγκατάθεση μάρκετινγκ: ανακλήθηκε στις {date}",
    "Συγκατάθεση μάρκετινγκ: δεν έχει καταγραφεί"
  ],
  pl: [
    "Wykorzystanie Twojego imienia i zdjęć w marketingu",
    "Dołączając na FLOQR do zespołu klubu, lounge’u, lokalu lub wydarzenia, pozwalasz każdemu lokalowi lub organizatorowi wydarzeń, do którego dołączasz, oraz jego administratorom i menedżerom używać Twojej nazwy profilu FLOQR, Twojej roli oraz zdjęć i filmów, które opublikowałeś(-aś) lub wybrałeś(-aś) na FLOQR, do promowania tego lokalu i jego wydarzeń.",
    "Obejmuje to ich strony internetowe, ulotki i plakaty oraz kampanie w mediach społecznościowych na platformach Instagram, Facebook, TikTok, YouTube i podobnych. Dopóki ta zgoda jest aktywna, nie muszą ponownie pytać Cię o każde nowe wykorzystanie. Zgoda jest niewyłączna i nieodpłatna: zachowujesz prawa do własnych zdjęć i filmów i nie należy Ci się żadne wynagrodzenie.",
    "Nie mogą publikować Twoich prywatnych danych kontaktowych, takich jak numer telefonu czy adres e-mail.",
    "Możesz w każdej chwili wycofać tę zgodę w sekcji Mój profil. Wycofanie zatrzymuje każde nowe wykorzystanie marketingowe. Materiałów wydrukowanych lub opublikowanych przed wycofaniem zgody nie trzeba wycofywać.",
    "Zgadzam się, aby lokale i organizatorzy wydarzeń, do których dołączam, wykorzystywali moje imię, rolę oraz opublikowane zdjęcia i filmy w marketingu, jak opisano powyżej.",
    "Zaznacz pole zgody marketingowej, aby kontynuować.",
    "Zgoda marketingowa",
    "Aktywna od {date}. Lokale i zespoły wydarzeń, do których dołączasz, mogą wykorzystywać Twoje imię, rolę oraz opublikowane zdjęcia i filmy w marketingu.",
    "Wycofana {date}. Lokale nie mogą rozpoczynać nowego marketingu z Twoim imieniem ani zdjęciami. Zapytamy Cię ponownie, zanim dołączysz do innego lokalu lub zespołu wydarzenia.",
    "Jeszcze nie udzielona. Zapytamy Cię, gdy dołączysz do lokalu lub zespołu wydarzenia.",
    "Wycofaj zgodę marketingową",
    "Udziel zgody marketingowej",
    "Wycofać zgodę marketingową? Lokale muszą przestać rozpoczynać nowy marketing z Twoim imieniem lub zdjęciami. Materiałów już wydrukowanych lub opublikowanych nie trzeba wycofywać.",
    "Zgoda marketingowa wycofana.",
    "Zgoda marketingowa zapisana.",
    "Nie udało się zapisać zgody. Spróbuj ponownie.",
    "Zgoda marketingowa: udzielona {date}",
    "Zgoda marketingowa: wycofana {date}",
    "Zgoda marketingowa: brak zapisu"
  ],
  ar: [
    "استخدام اسمك وصورك في التسويق",
    "عند انضمامك إلى فريق نادٍ أو لاونج أو مكان أو فعالية على FLOQR، فإنك تمنح كل مكان أو منظّم فعاليات تنضم إليه، ومسؤوليه ومديريه، إذنًا باستخدام اسم ملفك الشخصي على FLOQR ودورك والصور ومقاطع الفيديو التي نشرتها أو اخترتها على FLOQR للترويج لذلك المكان وفعالياته.",
    "يشمل ذلك مواقعهم الإلكترونية والمنشورات والملصقات وحملات وسائل التواصل الاجتماعي على Instagram وFacebook وTikTok وYouTube والمنصات المشابهة. ما دامت هذه الموافقة سارية، لا يلزمهم أن يطلبوا إذنك مجددًا لكل استخدام جديد. هذا الإذن غير حصري ومجاني: تحتفظ بحقوقك في صورك ومقاطع الفيديو الخاصة بك، ولا يُستحق لك أي مقابل.",
    "لا يجوز لهم نشر بيانات الاتصال الخاصة بك، مثل رقم هاتفك أو بريدك الإلكتروني.",
    "يمكنك سحب هذه الموافقة في أي وقت من ملفي. يوقف السحب أي استخدام تسويقي جديد. ولا يلزم استرجاع المواد التي طُبعت أو نُشرت قبل سحب موافقتك.",
    "أوافق على أن تستخدم الأماكن ومنظمو الفعاليات الذين أنضم إليهم اسمي ودوري وصوري ومقاطع الفيديو المنشورة لأغراض التسويق كما هو موضح أعلاه.",
    "حدّد مربع الموافقة على التسويق للمتابعة.",
    "الموافقة على التسويق",
    "سارية منذ {date}. يمكن للأماكن وفرق الفعاليات التي تنضم إليها استخدام اسمك ودورك وصورك ومقاطع الفيديو المنشورة للتسويق.",
    "سُحبت في {date}. لا يجوز للأماكن بدء تسويق جديد باسمك أو صورك. سنسألك مجددًا قبل انضمامك إلى مكان أو فريق فعالية آخر.",
    "لم تُمنح بعد. سنسألك عند انضمامك إلى مكان أو فريق فعالية.",
    "سحب الموافقة على التسويق",
    "منح الموافقة على التسويق",
    "هل تريد سحب موافقتك على التسويق؟ يجب على الأماكن التوقف عن بدء تسويق جديد باسمك أو صورك. ولا يلزم استرجاع المواد المطبوعة أو المنشورة بالفعل.",
    "تم سحب الموافقة على التسويق.",
    "تم حفظ الموافقة على التسويق.",
    "تعذّر حفظ موافقتك. حاول مرة أخرى.",
    "الموافقة على التسويق: مُنحت في {date}",
    "الموافقة على التسويق: سُحبت في {date}",
    "الموافقة على التسويق: غير مسجّلة"
  ]
};

const HELP_ID = consent.HELP.id;
const HELP = {
  ru: ["Согласие персонала на маркетинг", "Присоединяясь к команде заведения или мероприятия, вы должны отметить согласие на маркетинг. Оно позволяет этому заведению или организатору, а также его администраторам и менеджерам, использовать ваше имя в FLOQR, роль и опубликованные фото и видео на своих сайтах, флаерах и в соцсетях (Instagram, Facebook, TikTok, YouTube и похожих) без повторного запроса для каждого использования. Публиковать ваш телефон или email они не могут. Отозвать согласие можно в любой момент в разделе «Мой профиль», вкладка «Сервисы и участники сервиса». Это прекращает новый маркетинг; уже напечатанные или опубликованные материалы изымать не обязательно. Club Admins видят статус согласия каждого сотрудника в «Сети сотрудников и персонала» и в «Избранном персонале»."],
  nl: ["Marketingtoestemming voor personeel", "Wanneer je bij het team van een locatie of evenement aansluit, moet je het vakje voor marketingtoestemming aanvinken. Daarmee mogen die locatie of organisator en hun beheerders en managers je FLOQR-naam, je rol en je gepubliceerde foto’s en video’s gebruiken op hun websites, flyers en sociale media (Instagram, Facebook, TikTok, YouTube en vergelijkbare) zonder je voor elk gebruik opnieuw te vragen. Ze mogen je telefoonnummer of e-mailadres niet publiceren. Je kunt op elk moment intrekken in Mijn profiel, tabblad Services en servicemedewerkers. Dat stopt nieuwe marketing; materiaal dat al gedrukt of geplaatst is, hoeft niet te worden teruggehaald. Club Admins zien de toestemmingsstatus van elke medewerker in het Netwerk van medewerkers en personeel en bij Uitgelicht personeel."],
  fr: ["Consentement marketing du personnel", "Lorsque vous rejoignez l’équipe d’un lieu ou d’un événement, vous devez cocher la case de consentement marketing. Elle permet à ce lieu ou à cet organisateur, ainsi qu’à ses administrateurs et responsables, d’utiliser votre nom FLOQR, votre rôle et vos photos et vidéos publiées sur leurs sites web, flyers et réseaux sociaux (Instagram, Facebook, TikTok, YouTube et similaires) sans vous redemander votre accord à chaque utilisation. Ils ne peuvent pas publier votre numéro de téléphone ni votre e-mail. Vous pouvez retirer ce consentement à tout moment dans Mon profil, onglet Services et membres de service. Cela met fin aux nouvelles utilisations ; les supports déjà imprimés ou publiés n’ont pas à être retirés. Les Club Admins voient le statut de consentement de chaque membre du personnel dans Réseau des employés et du personnel et dans Personnel mis en avant."],
  de: ["Marketing-Einwilligung für Personal", "Wenn du dem Team einer Location oder eines Events beitrittst, musst du das Feld zur Marketing-Einwilligung anhaken. Damit dürfen diese Location oder dieser Veranstalter sowie deren Admins und Manager deinen FLOQR-Namen, deine Rolle und deine veröffentlichten Fotos und Videos auf ihren Websites, Flyern und in sozialen Medien (Instagram, Facebook, TikTok, YouTube und ähnliche) nutzen, ohne dich für jede Nutzung erneut zu fragen. Deine Telefonnummer und E-Mail dürfen sie nicht veröffentlichen. Du kannst jederzeit in Mein Profil im Tab Services und Service-Mitglieder widerrufen. Das stoppt neues Marketing; bereits gedruckte oder gepostete Materialien müssen nicht zurückgerufen werden. Club Admins sehen den Einwilligungsstatus jeder Person im Mitarbeiter- und Personalnetzwerk und bei Hervorgehobenes Personal."],
  es: ["Consentimiento de marketing del personal", "Cuando te unes al equipo de un local o evento, debes marcar la casilla de consentimiento de marketing. Permite que ese local u organizador, y sus administradores y gerentes, usen tu nombre de FLOQR, tu rol y tus fotos y videos publicados en sus sitios web, flyers y redes sociales (Instagram, Facebook, TikTok, YouTube y similares) sin volver a pedirte permiso para cada uso. No pueden publicar tu teléfono ni tu correo electrónico. Puedes retirarlo en cualquier momento en Mi perfil, pestaña Servicios y miembros de servicio. Esto detiene el nuevo marketing; los materiales ya impresos o publicados no tienen que retirarse. Los Club Admins ven el estado del consentimiento de cada miembro del personal en Red de empleados y personal y en Personal destacado."],
  it: ["Consenso marketing del personale", "Quando entri nel team di un locale o di un evento, devi selezionare la casella del consenso marketing. Consente a quel locale o organizzatore, e ai suoi amministratori e manager, di usare il tuo nome FLOQR, il tuo ruolo e le tue foto e i tuoi video pubblicati su siti web, volantini e social media (Instagram, Facebook, TikTok, YouTube e simili) senza chiederti di nuovo il permesso per ogni utilizzo. Non possono pubblicare il tuo numero di telefono né la tua email. Puoi revocarlo in qualsiasi momento in Il mio profilo, scheda Servizi e membri del servizio. La revoca interrompe il nuovo marketing; i materiali già stampati o pubblicati non devono essere ritirati. I Club Admin vedono lo stato del consenso di ogni membro del personale in Rete di dipendenti e personale e in Personale in evidenza."],
  pt: ["Consentimento de marketing da equipe", "Quando você entra na equipe de uma casa ou evento, precisa marcar a caixa de consentimento de marketing. Ela permite que essa casa ou organizador, e seus administradores e gerentes, usem seu nome no FLOQR, sua função e suas fotos e vídeos publicados em sites, flyers e redes sociais (Instagram, Facebook, TikTok, YouTube e similares) sem pedir sua permissão novamente a cada uso. Eles não podem publicar seu telefone nem seu e-mail. Você pode retirar o consentimento a qualquer momento em Meu perfil, aba Serviços e membros do serviço. Isso interrompe novo marketing; materiais já impressos ou publicados não precisam ser recolhidos. Os Club Admins veem o status de consentimento de cada pessoa da equipe em Rede de funcionários e equipe e em Equipe em destaque."],
  el: ["Συγκατάθεση μάρκετινγκ προσωπικού", "Όταν εντάσσεστε στην ομάδα ενός χώρου ή μιας εκδήλωσης, πρέπει να επιλέξετε το πλαίσιο συγκατάθεσης μάρκετινγκ. Επιτρέπει σε αυτόν τον χώρο ή διοργανωτή, και στους διαχειριστές και υπευθύνους του, να χρησιμοποιούν το όνομά σας στο FLOQR, τον ρόλο σας και τις δημοσιευμένες φωτογραφίες και βίντεό σας σε ιστότοπους, φυλλάδια και μέσα κοινωνικής δικτύωσης (Instagram, Facebook, TikTok, YouTube και παρόμοια) χωρίς να σας ρωτούν ξανά για κάθε χρήση. Δεν επιτρέπεται να δημοσιεύουν το τηλέφωνο ή το email σας. Μπορείτε να την ανακαλέσετε ανά πάσα στιγμή στο «Το προφίλ μου», καρτέλα «Μέλη Υπηρεσιών & Υπηρεσιών». Η ανάκληση σταματά το νέο μάρκετινγκ· υλικό που έχει ήδη τυπωθεί ή δημοσιευτεί δεν χρειάζεται να αποσυρθεί. Οι Club Admins βλέπουν την κατάσταση συγκατάθεσης κάθε μέλους του προσωπικού στο Δίκτυο υπαλλήλων και προσωπικού και στο Προβεβλημένο προσωπικό."],
  pl: ["Zgoda marketingowa personelu", "Dołączając do zespołu lokalu lub wydarzenia, musisz zaznaczyć pole zgody marketingowej. Pozwala ona temu lokalowi lub organizatorowi oraz jego administratorom i menedżerom używać Twojej nazwy FLOQR, roli oraz opublikowanych zdjęć i filmów na swoich stronach, ulotkach i w mediach społecznościowych (Instagram, Facebook, TikTok, YouTube i podobne) bez ponownego pytania o każde użycie. Nie mogą publikować Twojego numeru telefonu ani adresu e-mail. Zgodę możesz wycofać w każdej chwili w sekcji Mój profil, karta Usługi i członkowie serwisu. Wycofanie zatrzymuje nowy marketing; materiałów już wydrukowanych lub opublikowanych nie trzeba wycofywać. Club Admini widzą status zgody każdej osoby w Sieci pracowników i personelu oraz w Wyróżnionym personelu."],
  ar: ["موافقة الطاقم على التسويق", "عند انضمامك إلى فريق مكان أو فعالية، يجب أن تحدد مربع الموافقة على التسويق. تسمح هذه الموافقة لذلك المكان أو المنظّم ومسؤوليه ومديريه باستخدام اسمك على FLOQR ودورك وصورك ومقاطع الفيديو المنشورة على مواقعهم الإلكترونية ومنشوراتهم ووسائل التواصل الاجتماعي (Instagram وFacebook وTikTok وYouTube وما شابهها) دون أن يطلبوا إذنك مجددًا لكل استخدام. لا يجوز لهم نشر رقم هاتفك أو بريدك الإلكتروني. يمكنك سحب الموافقة في أي وقت من ملفي، علامة تبويب أعضاء الخدمات والخدمة. يوقف السحب التسويق الجديد، ولا يلزم استرجاع المواد المطبوعة أو المنشورة بالفعل. يرى Club Admins حالة موافقة كل فرد من الطاقم في شبكة الموظفين والعاملين وفي الطاقم المميز."]
};

for (const [lang, rows] of Object.entries(T)) {
  if (rows.length !== KEYS.length) throw new Error(`${lang}: ${rows.length} strings, expected ${KEYS.length}`);
  rows.forEach((row, i) => {
    if (!row) throw new Error(`${lang}.${KEYS[i]} empty`);
    const vars = s => (s.match(/\{\w+\}/g) || []).sort().join(",");
    if (vars(row) !== vars(T.en[i])) throw new Error(`${lang}.${KEYS[i]} placeholders differ`);
  });
}

// 1) Chrome packs: after each pack's "featuredStaff.consentRecorded" line.
(function chrome() {
  let src = read("floqr-i18n.js");
  if (src.includes('"staffConsent.title"')) throw new Error("staffConsent chrome keys already present");
  const eol = eolOf(src);
  const chromeStart = src.indexOf("const CHROME = ");
  const anchor = /^(\s*)"featuredStaff\.consentRecorded": .*,\r?\n/gm;
  const hits = [...src.matchAll(anchor)].filter(m => m.index > chromeStart);
  if (hits.length !== 11) throw new Error(`consentRecorded hits ${hits.length}`);
  const seen = new Set();
  for (const m of hits.reverse()) {
    const before = src.slice(chromeStart, m.index);
    const packs = [...before.matchAll(/^ {4}([a-z]{2}): \{\r?$/gm)];
    const lang = packs.length ? packs[packs.length - 1][1] : "";
    if (!T[lang] || seen.has(lang)) throw new Error(`unexpected pack ${lang}`);
    seen.add(lang);
    const block = KEYS.map((key, k) => `${m[1]}"staffConsent.${key}": ${q(T[lang][k])},${eol}`).join("");
    const pos = m.index + m[0].length;
    src = src.slice(0, pos) + block + src.slice(pos);
  }
  write("floqr-i18n.js", src);
  console.log(`chrome: ${KEYS.length} keys x ${seen.size} packs`);
})();

// 2) Help packs: first entry of every pack.
(function helpPacks() {
  let src = read("floqr-i18n-help.js");
  if (src.includes(`"${HELP_ID}"`)) throw new Error("help id already in floqr-i18n-help.js");
  const eol = eolOf(src);
  const start = src.indexOf("const packs = ");
  const heads = [...src.matchAll(/^ {4}([a-z]{2}): \{\r?\n/gm)].filter(m => m.index > start);
  const langs = heads.map(m => m[1]);
  if (langs.length !== 10 || langs.some(lang => !HELP[lang])) throw new Error(`help packs ${langs.join(",")}`);
  for (const m of heads.reverse()) {
    const [title, body] = HELP[m[1]];
    const block = `      ${q(HELP_ID)}: {${eol}        title: ${q(title)},${eol}        body: ${q(body)}${eol}      },${eol}`;
    const pos = m.index + m[0].length;
    src = src.slice(0, pos) + block + src.slice(pos);
  }
  write("floqr-i18n-help.js", src);
  console.log(`help packs: ${langs.length}`);
})();

// 3) English help: FloqAi repository + canonical _help-en.json.
(function englishHelp() {
  let repo = read("floqai-help-repository.js");
  if (repo.includes(`"${HELP_ID}"`)) throw new Error("help id already in floqai-help-repository.js");
  const eol = eolOf(repo);
  const anchor = /^ {4}\{\r?\n {6}id: "help-featured-staff",/m;
  const m = repo.match(anchor);
  if (!m) throw new Error("help-featured-staff anchor not found");
  const entry = [
    "    {",
    `      id: ${q(HELP_ID)},`,
    `      title: ${q(consent.HELP.title)},`,
    `      body: ${q(consent.HELP.body)},`,
    `      searchPhrases: [${consent.HELP.searchPhrases.map(q).join(", ")}],`,
    "      links: [",
    "        {label: \"Services & Service Members\", href: vUrl(\"./patron-portal.html\", {from: \"floqai\", tab: \"service-members\"})},",
    "        {label: \"Club Admin Employee/Workers\", href: vUrl(\"./admin.html\", {from: \"floqai\", tab: \"employees\"})}",
    "      ],",
    "      audiences: [\"patron\", \"serviceMember\", \"venueAdmin\"],",
    "      source: \"help-repository-seed\",",
    "      page: \"patron-portal.html\"",
    "    },"
  ].join(eol) + eol;
  repo = repo.slice(0, m.index) + entry + repo.slice(m.index);
  write("floqai-help-repository.js", repo);

  let json = read("scripts/_help-en.json");
  if (json.includes(`"${HELP_ID}"`)) throw new Error("help id already in _help-en.json");
  const jeol = eolOf(json);
  const janchor = '  "help-featured-staff": {';
  if (json.split(janchor).length !== 2) throw new Error("_help-en.json anchor not found once");
  const jentry = `  ${q(HELP_ID)}: {${jeol}    "title": ${q(consent.HELP.title)},${jeol}    "body": ${q(consent.HELP.body)}${jeol}  },${jeol}`;
  json = json.replace(janchor, jentry + janchor);
  JSON.parse(json);
  write("scripts/_help-en.json", json);
  console.log("english help: repository + _help-en.json");
})();
