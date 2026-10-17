#!/usr/bin/env node
/* Add beta invite consent / success chrome keys to every CHROME pack; update beta.accept. */
"use strict";

const fs = require("fs");
const path = require("path");

const file = path.resolve(__dirname, "..", "floqr-i18n.js");
let src = fs.readFileSync(file, "utf8");

const ACCEPT = {
  en: "I Agree and join beta",
  fr: "J’accepte et je rejoins la bêta",
  de: "Ich stimme zu und trete der Beta bei",
  es: "Acepto y me uno a la beta",
  nl: "Ik ga akkoord en doe mee aan de bèta",
  ru: "Я соглашаюсь и присоединяюсь к бете",
  it: "Accetto e partecipo alla beta",
  pt: "Concordo e entro na beta",
  el: "Συμφωνώ και συμμετέχω στη beta",
  pl: "Zgadzam się i dołączam do bety",
  ar: "أوافق وأنضم إلى النسخة التجريبية"
};

const PACKS = {
  en: {
    "beta.restoring": "Restoring your FLOQR session…",
    "beta.ready": "Signed in. Read the Agreement, accept both checkboxes, then I Agree and join beta.",
    "beta.agreementTitle": "FloqR.app Beta Test & Prerelease Agreement",
    "beta.agreementSub": "Read the full Agreement below. Both checkboxes are required before you can join. Agreement text is in English.",
    "beta.bookingTitle": "Booking Transaction Disclaimer",
    "beta.bookingBody": "Because FloqR.app is in a QA testing phase and has not completed UAT, ticket sales, table reservations, VIP entry, and other payments made through the Beta Product are final and non-refundable by FloqMedia. You participate at your own risk. Disputes about venue entry or payment must be resolved with the venue or the payment processor (e.g., Stripe, Papi, or Social OS).",
    "beta.checkAgreement": "I have read and accept the FloqR.app Beta Test Agreement (including that FloqR.app has not completed UAT and is in QA testing, provided AS IS)",
    "beta.checkBooking": "I accept the Booking Transaction Disclaimer: all beta reservations, tickets, and payments are final and non-refundable; I participate at my own risk",
    "beta.consentRequired": "Accept both the Beta Test Agreement and the Booking Transaction Disclaimer to join.",
    "beta.successEyebrow": "Beta program",
    "beta.successTitle": "You're a FLOQR beta tester",
    "beta.successAck": "Your acceptance of the FloqR.app Beta Test Agreement and Booking Transaction Disclaimer was recorded for this account.",
    "beta.successStatus": "Joined — Agreement accepted and recorded.",
    "beta.alreadyJoined": "You already joined this beta invitation.",
    "beta.goSearch": "Open Search to try Beta features",
    "help.beta.title": "Beta testing",
    "help.beta.body": "Open this invite while signed in to the same account. Read the FloqR.app Beta Test Agreement, accept both required checkboxes, then I Agree and join beta. Search then shows your granted features with a Beta label."
  },
  fr: {
    "beta.restoring": "Restauration de votre session FLOQR…",
    "beta.ready": "Connecté. Lisez l’Accord, cochez les deux cases, puis J’accepte et je rejoins la bêta.",
    "beta.agreementTitle": "Accord de test bêta et préversion FloqR.app",
    "beta.agreementSub": "Lisez l’Accordo complet ci-dessous. Les deux cases sont obligatoires pour rejoindre. Le texte de l’Accord est en anglais.",
    "beta.bookingTitle": "Avertissement sur les transactions de réservation",
    "beta.bookingBody": "Parce que FloqR.app est en phase de QA et n’a pas terminé l’UAT, les billets, réservations de table, entrées VIP et autres paiements via le produit bêta sont définitifs et non remboursables par FloqMedia. Vous participez à vos risques. Les litiges d’entrée ou de paiement se règlent avec le lieu ou le processeur de paiement (p. ex. Stripe, Papi ou Social OS).",
    "beta.checkAgreement": "J’ai lu et j’accepte l’Accord de test bêta FloqR.app (y compris qu’il n’a pas terminé l’UAT, qu’il est en QA, fourni TEL QUEL)",
    "beta.checkBooking": "J’accepte l’avertissement sur les transactions : toutes les réservations, billets et paiements bêta sont définitifs et non remboursables ; je participe à mes risques",
    "beta.consentRequired": "Acceptez l’Accord de test bêta et l’avertissement sur les transactions pour rejoindre.",
    "beta.successEyebrow": "Programme bêta",
    "beta.successTitle": "Vous êtes bêta-testeur FLOQR",
    "beta.successAck": "Votre acceptation de l’Accord de test bêta FloqR.app et de l’avertissement sur les transactions a été enregistrée pour ce compte.",
    "beta.successStatus": "Inscription réussie — Accord accepté et enregistré.",
    "beta.alreadyJoined": "Vous avez déjà rejoint cette invitation bêta.",
    "beta.goSearch": "Ouvrir la recherche pour essayer les fonctions Bêta",
    "help.beta.title": "Test bêta",
    "help.beta.body": "Ouvrez cette invitation en étant connecté au même compte. Lisez l’Accord de test bêta FloqR.app, cochez les deux cases obligatoires, puis J’accepte et je rejoins la bêta. La recherche affiche ensuite vos fonctions avec l’étiquette Bêta."
  },
  de: {
    "beta.restoring": "FLOQR-Sitzung wird wiederhergestellt…",
    "beta.ready": "Angemeldet. Lies die Vereinbarung, aktiviere beide Kontrollkästchen und tippe dann Ich stimme zu und trete der Beta bei.",
    "beta.agreementTitle": "FloqR.app-Beta- und Vorabversionsvereinbarung",
    "beta.agreementSub": "Lies die vollständige Vereinbarung unten. Beide Kontrollkästchen sind erforderlich. Der Vereinbarungstext ist auf Englisch.",
    "beta.bookingTitle": "Hinweis zu Buchungstransaktionen",
    "beta.bookingBody": "Weil FloqR.app in der QA-Phase ist und UAT nicht abgeschlossen hat, sind Ticketverkäufe, Tischreservierungen, VIP-Eintritt und andere Zahlungen über das Beta-Produkt endgültig und von FloqMedia nicht erstattungsfähig. Du nimmst auf eigenes Risiko teil. Streitigkeiten zu Eintritt oder Zahlung klärst du mit dem Venue oder dem Zahlungsanbieter (z. B. Stripe, Papi oder Social OS).",
    "beta.checkAgreement": "Ich habe die FloqR.app-Beta-Testvereinbarung gelesen und akzeptiere sie (einschließlich, dass UAT nicht abgeschlossen ist, QA läuft und die Software WIE BESEHEN bereitgestellt wird)",
    "beta.checkBooking": "Ich akzeptiere den Hinweis zu Buchungstransaktionen: alle Beta-Reservierungen, Tickets und Zahlungen sind endgültig und nicht erstattungsfähig; ich nehme auf eigenes Risiko teil",
    "beta.consentRequired": "Akzeptiere sowohl die Beta-Testvereinbarung als auch den Hinweis zu Buchungstransaktionen, um beizutreten.",
    "beta.successEyebrow": "Beta-Programm",
    "beta.successTitle": "Du bist FLOQR-Betatester",
    "beta.successAck": "Deine Annahme der FloqR.app-Beta-Testvereinbarung und des Hinweises zu Buchungstransaktionen wurde für dieses Konto gespeichert.",
    "beta.successStatus": "Beigetreten — Vereinbarung akzeptiert und gespeichert.",
    "beta.alreadyJoined": "Du bist dieser Beta-Einladung bereits beigetreten.",
    "beta.goSearch": "Suche öffnen, um Beta-Funktionen zu testen",
    "help.beta.title": "Beta-Tests",
    "help.beta.body": "Öffne diese Einladung, während du mit demselben Konto angemeldet bist. Lies die FloqR.app-Beta-Testvereinbarung, aktiviere beide Pflichtkästchen und tippe Ich stimme zu und trete der Beta bei. In der Suche erscheinen deine freigeschalteten Funktionen mit dem Label Beta."
  },
  es: {
    "beta.restoring": "Restaurando tu sesión FLOQR…",
    "beta.ready": "Sesión iniciada. Lee el Acuerdo, marca ambas casillas y luego Acepto y me uno a la beta.",
    "beta.agreementTitle": "Acuerdo de prueba beta y prerelease de FloqR.app",
    "beta.agreementSub": "Lee el Acuerdo completo abajo. Ambas casillas son obligatorias para unirte. El texto del Acuerdo está en inglés.",
    "beta.bookingTitle": "Aviso de transacciones de reserva",
    "beta.bookingBody": "Como FloqR.app está en fase de QA y no ha completado la UAT, las ventas de entradas, reservas de mesa, entrada VIP y otros pagos del producto beta son definitivos y no reembolsables por FloqMedia. Participas bajo tu propio riesgo. Las disputas de entrada o pago se resuelven con el local o el procesador de pagos (p. ej., Stripe, Papi o Social OS).",
    "beta.checkAgreement": "He leído y acepto el Acuerdo de prueba beta de FloqR.app (incluido que no ha completado la UAT, está en QA y se ofrece TAL CUAL)",
    "beta.checkBooking": "Acepto el Aviso de transacciones de reserva: todas las reservas, entradas y pagos beta son definitivos y no reembolsables; participo bajo mi propio riesgo",
    "beta.consentRequired": "Acepta el Acuerdo de prueba beta y el Aviso de transacciones de reserva para unirte.",
    "beta.successEyebrow": "Programa beta",
    "beta.successTitle": "Eres beta tester de FLOQR",
    "beta.successAck": "Tu aceptación del Acuerdo de prueba beta de FloqR.app y del Aviso de transacciones de reserva quedó registrada en esta cuenta.",
    "beta.successStatus": "Unido — Acuerdo aceptado y registrado.",
    "beta.alreadyJoined": "Ya te uniste a esta invitación beta.",
    "beta.goSearch": "Abrir Búsqueda para probar funciones Beta",
    "help.beta.title": "Pruebas beta",
    "help.beta.body": "Abre esta invitación iniciando sesión con la misma cuenta. Lee el Acuerdo de prueba beta de FloqR.app, marca ambas casillas obligatorias y luego Acepto y me uno a la beta. En Búsqueda verás tus funciones con la etiqueta Beta."
  },
  nl: {
    "beta.restoring": "Je FLOQR-sessie wordt hersteld…",
    "beta.ready": "Ingelogd. Lees de Overeenkomst, vink beide vakjes aan en tik daarna Ik ga akkoord en doe mee aan de bèta.",
    "beta.agreementTitle": "FloqR.app-bètatest- en prereleaseovereenkomst",
    "beta.agreementSub": "Lees de volledige Overeenkomst hieronder. Beide vakjes zijn verplicht. De tekst van de Overeenkomst is in het Engels.",
    "beta.bookingTitle": "Disclaimer boekingstransacties",
    "beta.bookingBody": "Omdat FloqR.app in een QA-fase zit en UAT niet heeft afgerond, zijn ticketverkoop, tafelreserveringen, VIP-toegang en andere betalingen via het bètaproduct definitief en niet-restitueerbaar door FloqMedia. Je doet mee op eigen risico. Geschillen over toegang of betaling regel je met de venue of de betaalverwerker (bijv. Stripe, Papi of Social OS).",
    "beta.checkAgreement": "Ik heb de FloqR.app-bètatestovereenkomst gelezen en accepteer die (inclusief dat UAT niet is afgerond, QA loopt en de software AS IS wordt geleverd)",
    "beta.checkBooking": "Ik accepteer de disclaimer boekingstransacties: alle bètareserveringen, tickets en betalingen zijn definitief en niet-restitueerbaar; ik doe mee op eigen risico",
    "beta.consentRequired": "Accepteer zowel de bètatestovereenkomst als de disclaimer boekingstransacties om mee te doen.",
    "beta.successEyebrow": "Bètaprogramma",
    "beta.successTitle": "Je bent FLOQR-bètatester",
    "beta.successAck": "Je acceptatie van de FloqR.app-bètatestovereenkomst en de disclaimer boekingstransacties is voor dit account vastgelegd.",
    "beta.successStatus": "Meegedaan — Overeenkomst geaccepteerd en vastgelegd.",
    "beta.alreadyJoined": "Je bent deze bèta-uitnodiging al geaccepteerd.",
    "beta.goSearch": "Open Zoeken om bètafuncties te proberen",
    "help.beta.title": "Bètatesten",
    "help.beta.body": "Open deze uitnodiging terwijl je bent ingelogd op hetzelfde account. Lees de FloqR.app-bètatestovereenkomst, vink beide verplichte vakjes aan en tik Ik ga akkoord en doe mee aan de bèta. Bij Zoeken verschijnen je functies met het label Bèta."
  },
  ru: {
    "beta.restoring": "Восстановление сеанса FLOQR…",
    "beta.ready": "Вы вошли. Прочитайте Соглашение, отметьте оба флажка и нажмите «Я соглашаюсь и присоединяюсь к бете».",
    "beta.agreementTitle": "Соглашение о бета-тесте и пререлизе FloqR.app",
    "beta.agreementSub": "Прочитайте полное Соглашение ниже. Оба флажка обязательны. Текст Соглашения на английском.",
    "beta.bookingTitle": "Отказ от ответственности по транзакциям бронирования",
    "beta.bookingBody": "Поскольку FloqR.app находится на этапе QA и не завершил UAT, продажи билетов, бронирование столов, VIP-вход и другие платежи через бета-продукт являются окончательными и не подлежат возврату FloqMedia. Вы участвуете на свой риск. Споры о входе или оплате решаются с заведением или платёжным процессором (например, Stripe, Papi или Social OS).",
    "beta.checkAgreement": "Я прочитал(а) и принимаю Соглашение о бета-тесте FloqR.app (включая то, что UAT не завершён, идёт QA, продукт предоставляется «КАК ЕСТЬ»)",
    "beta.checkBooking": "Я принимаю отказ от ответственности по транзакциям: все бета-бронирования, билеты и платежи окончательны и невозвратны; я участвую на свой риск",
    "beta.consentRequired": "Примите Соглашение о бета-тесте и отказ от ответственности по транзакциям, чтобы присоединиться.",
    "beta.successEyebrow": "Бета-программа",
    "beta.successTitle": "Вы бета-тестер FLOQR",
    "beta.successAck": "Ваше принятие Соглашения о бета-тесте FloqR.app и отказа от ответственности по транзакциям записано для этого аккаунта.",
    "beta.successStatus": "Присоединились — Соглашение принято и записано.",
    "beta.alreadyJoined": "Вы уже приняли это бета-приглашение.",
    "beta.goSearch": "Открыть поиск, чтобы попробовать бета-функции",
    "help.beta.title": "Бета-тестирование",
    "help.beta.body": "Откройте это приглашение, войдя в тот же аккаунт. Прочитайте Соглашение о бета-тесте FloqR.app, отметьте оба обязательных флажка и нажмите «Я соглашаюсь и присоединяюсь к бете». В поиске появятся ваши функции с меткой «Бета»."
  },
  it: {
    "beta.restoring": "Ripristino della sessione FLOQR…",
    "beta.ready": "Accesso effettuato. Leggi l’Accordo, spunta entrambe le caselle, poi Accetto e partecipo alla beta.",
    "beta.agreementTitle": "Accordo di beta test e prerelease di FloqR.app",
    "beta.agreementSub": "Leggi l’Accordo completo qui sotto. Entrambe le caselle sono obbligatorie. Il testo dell’Accordo è in inglese.",
    "beta.bookingTitle": "Disclaimer sulle transazioni di prenotazione",
    "beta.bookingBody": "Poiché FloqR.app è in fase di QA e non ha completato l’UAT, vendite di biglietti, prenotazioni tavolo, ingresso VIP e altri pagamenti tramite il prodotto beta sono definitivi e non rimborsabili da FloqMedia. Partecipi a tuo rischio. Le controversie su ingresso o pagamento si risolvono con il locale o il processore di pagamento (es. Stripe, Papi o Social OS).",
    "beta.checkAgreement": "Ho letto e accetto l’Accordo di beta test FloqR.app (incluso che non ha completato l’UAT, è in QA e viene fornito COSÌ COM’È)",
    "beta.checkBooking": "Accetto il disclaimer sulle transazioni di prenotazione: tutte le prenotazioni, i biglietti e i pagamenti beta sono definitivi e non rimborsabili; partecipo a mio rischio",
    "beta.consentRequired": "Accetta sia l’Accordo di beta test sia il disclaimer sulle transazioni per partecipare.",
    "beta.successEyebrow": "Programma beta",
    "beta.successTitle": "Sei beta tester FLOQR",
    "beta.successAck": "La tua accettazione dell’Accordo di beta test FloqR.app e del disclaimer sulle transazioni è stata registrata per questo account.",
    "beta.successStatus": "Iscritto — Accordo accettato e registrato.",
    "beta.alreadyJoined": "Hai già accettato questo invito beta.",
    "beta.goSearch": "Apri Cerca per provare le funzioni Beta",
    "help.beta.title": "Beta testing",
    "help.beta.body": "Apri questo invito restando connesso allo stesso account. Leggi l’Accordo di beta test FloqR.app, spunta entrambe le caselle obbligatorie, poi Accetto e partecipo alla beta. In Cerca compaiono le tue funzioni con l’etichetta Beta."
  },
  pt: {
    "beta.restoring": "A restaurar a sua sessão FLOQR…",
    "beta.ready": "Sessão iniciada. Leia o Acordo, marque as duas caixas e depois Concordo e entro na beta.",
    "beta.agreementTitle": "Acordo de teste beta e prerelease do FloqR.app",
    "beta.agreementSub": "Leia o Acordo completo abaixo. Ambas as caixas são obrigatórias. O texto do Acordo está em inglês.",
    "beta.bookingTitle": "Aviso de transações de reserva",
    "beta.bookingBody": "Como o FloqR.app está em fase de QA e não concluiu a UAT, vendas de bilhetes, reservas de mesa, entrada VIP e outros pagamentos pelo produto beta são finais e não reembolsáveis pela FloqMedia. Participa por sua conta e risco. Litígios de entrada ou pagamento resolvem-se com o local ou o processador de pagamentos (p. ex., Stripe, Papi ou Social OS).",
    "beta.checkAgreement": "Li e aceito o Acordo de teste beta do FloqR.app (incluindo que não concluiu a UAT, está em QA e é fornecido TAL COMO ESTÁ)",
    "beta.checkBooking": "Aceito o Aviso de transações de reserva: todas as reservas, bilhetes e pagamentos beta são finais e não reembolsáveis; participo por minha conta e risco",
    "beta.consentRequired": "Aceite o Acordo de teste beta e o Aviso de transações de reserva para entrar.",
    "beta.successEyebrow": "Programa beta",
    "beta.successTitle": "É beta tester FLOQR",
    "beta.successAck": "A sua aceitação do Acordo de teste beta do FloqR.app e do Aviso de transações de reserva foi registada nesta conta.",
    "beta.successStatus": "Entrou — Acordo aceite e registado.",
    "beta.alreadyJoined": "Já aceitou este convite beta.",
    "beta.goSearch": "Abrir Pesquisa para experimentar funções Beta",
    "help.beta.title": "Testes beta",
    "help.beta.body": "Abra este convite com sessão iniciada na mesma conta. Leia o Acordo de teste beta do FloqR.app, marque as duas caixas obrigatórias e depois Concordo e entro na beta. Na Pesquisa aparecem as suas funções com a etiqueta Beta."
  },
  el: {
    "beta.restoring": "Επαναφορά της συνεδρίας FLOQR…",
    "beta.ready": "Συνδεθήκατε. Διαβάστε τη Συμφωνία, επιλέξτε και τα δύο πλαίσια και μετά Συμφωνώ και συμμετέχω στη beta.",
    "beta.agreementTitle": "Συμφωνία δοκιμής beta και προκυκλοφορίας FloqR.app",
    "beta.agreementSub": "Διαβάστε την πλήρη Συμφωνία παρακάτω. Και τα δύο πλαίσια είναι υποχρεωτικά. Το κείμενο της Συμφωνίας είναι στα αγγλικά.",
    "beta.bookingTitle": "Αποποίηση ευθύνης συναλλαγών κράτησης",
    "beta.bookingBody": "Επειδή το FloqR.app βρίσκεται σε φάση QA και δεν έχει ολοκληρώσει UAT, οι πωλήσεις εισιτηρίων, οι κρατήσεις τραπεζιών, η VIP είσοδος και άλλες πληρωμές μέσω του beta προϊόντος είναι οριστικές και μη επιστρέψιμες από τη FloqMedia. Συμμετέχετε με δική σας ευθύνη. Διαφορές εισόδου ή πληρωμής επιλύονται με τον χώρο ή τον επεξεργαστή πληρωμών (π.χ. Stripe, Papi ή Social OS).",
    "beta.checkAgreement": "Διάβασα και αποδέχομαι τη Συμφωνία δοκιμής beta FloqR.app (συμπεριλαμβανομένου ότι δεν έχει ολοκληρωθεί UAT, βρίσκεται σε QA και παρέχεται ΩΣ ΕΧΕΙ)",
    "beta.checkBooking": "Αποδέχομαι την αποποίηση ευθύνης συναλλαγών κράτησης: όλες οι beta κρατήσεις, εισιτήρια και πληρωμές είναι οριστικές και μη επιστρέψιμες· συμμετέχω με δική μου ευθύνη",
    "beta.consentRequired": "Αποδεχτείτε τη Συμφωνία δοκιμής beta και την αποποίηση ευθύνης συναλλαγών για να συμμετάσχετε.",
    "beta.successEyebrow": "Πρόγραμμα beta",
    "beta.successTitle": "Είστε beta tester του FLOQR",
    "beta.successAck": "Η αποδοχή της Συμφωνίας δοκιμής beta FloqR.app και της αποποίησης ευθύνης συναλλαγών καταγράφηκε για αυτόν τον λογαριασμό.",
    "beta.successStatus": "Εγγραφή — Συμφωνία αποδεκτή και καταγεγραμμένη.",
    "beta.alreadyJoined": "Έχετε ήδη αποδεχτεί αυτήν την πρόσκληση beta.",
    "beta.goSearch": "Άνοιγμα Αναζήτησης για δοκιμή λειτουργιών Beta",
    "help.beta.title": "Δοκιμές beta",
    "help.beta.body": "Ανοίξτε αυτήν την πρόσκληση ενώ είστε συνδεδεμένοι στον ίδιο λογαριασμό. Διαβάστε τη Συμφωνία δοκιμής beta FloqR.app, επιλέξτε και τα δύο υποχρεωτικά πλαίσια και μετά Συμφωνώ και συμμετέχω στη beta. Στην Αναζήτηση εμφανίζονται οι λειτουργίες σας με ετικέτα Beta."
  },
  pl: {
    "beta.restoring": "Przywracanie sesji FLOQR…",
    "beta.ready": "Zalogowano. Przeczytaj Umowę, zaznacz oba pola, a potem Zgadzam się i dołączam do bety.",
    "beta.agreementTitle": "Umowa testów beta i wersji wstępnej FloqR.app",
    "beta.agreementSub": "Przeczytaj pełną Umowę poniżej. Oba pola są wymagane. Tekst Umowy jest po angielsku.",
    "beta.bookingTitle": "Zastrzeżenie dotyczące transakcji rezerwacji",
    "beta.bookingBody": "Ponieważ FloqR.app jest w fazie QA i nie ukończyło UAT, sprzedaż biletów, rezerwacje stolików, wejście VIP i inne płatności przez produkt beta są ostateczne i niepodlegające zwrotowi przez FloqMedia. Bierzesz udział na własne ryzyko. Spory o wejście lub płatność rozstrzygasz z lokalem lub procesorem płatności (np. Stripe, Papi lub Social OS).",
    "beta.checkAgreement": "Przeczytałem/am i akceptuję Umowę testów beta FloqR.app (w tym że UAT nie zostało ukończone, trwa QA, a oprogramowanie jest dostarczane W STANIE JAKIM JEST)",
    "beta.checkBooking": "Akceptuję zastrzeżenie dotyczące transakcji rezerwacji: wszystkie rezerwacje, bilety i płatności beta są ostateczne i niepodlegające zwrotowi; biorę udział na własne ryzyko",
    "beta.consentRequired": "Zaakceptuj Umowę testów beta i zastrzeżenie dotyczące transakcji, aby dołączyć.",
    "beta.successEyebrow": "Program beta",
    "beta.successTitle": "Jesteś beta testerem FLOQR",
    "beta.successAck": "Twoja akceptacja Umowy testów beta FloqR.app i zastrzeżenia dotyczącego transakcji została zapisana dla tego konta.",
    "beta.successStatus": "Dołączono — Umowa zaakceptowana i zapisana.",
    "beta.alreadyJoined": "Już dołączyłeś/aś do tego zaproszenia beta.",
    "beta.goSearch": "Otwórz Wyszukiwanie, aby wypróbować funkcje Beta",
    "help.beta.title": "Testy beta",
    "help.beta.body": "Otwórz to zaproszenie będąc zalogowanym na to samo konto. Przeczytaj Umowę testów beta FloqR.app, zaznacz oba wymagane pola, a potem Zgadzam się i dołączam do bety. W Wyszukiwaniu pojawią się Twoje funkcje z etykietą Beta."
  },
  ar: {
    "beta.restoring": "جارٍ استعادة جلسة FLOQR…",
    "beta.ready": "تم تسجيل الدخول. اقرأ الاتفاقية، وفعّل المربعين، ثم اضغط أوافق وأنضم إلى النسخة التجريبية.",
    "beta.agreementTitle": "اتفاقية اختبار بيتا والإصدار المسبق لـ FloqR.app",
    "beta.agreementSub": "اقرأ الاتفاقية كاملة أدناه. المربعين إلزاميان قبل الانضمام. نص الاتفاقية بالإنجليزية.",
    "beta.bookingTitle": "إخلاء مسؤولية معاملات الحجز",
    "beta.bookingBody": "لأن FloqR.app في مرحلة ضمان الجودة ولم يُكمل اختبار قبول المستخدم، فإن مبيعات التذاكر وحجوزات الطاولات ودخول VIP والمدفوعات الأخرى عبر منتج البيتا نهائية وغير قابلة للاسترداد من FloqMedia. تشارك على مسؤوليتك. تُحل نزاعات الدخول أو الدفع مع المكان أو معالج الدفع (مثل Stripe أو Papi أو Social OS).",
    "beta.checkAgreement": "لقد قرأت وأقبل اتفاقية اختبار بيتا لـ FloqR.app (بما في ذلك أن اختبار قبول المستخدم لم يكتمل، وأن المنتج في ضمان الجودة، ويُقدَّم كما هو)",
    "beta.checkBooking": "أقبل إخلاء مسؤولية معاملات الحجز: جميع حجوزات وتذاكر ومدفوعات البيتا نهائية وغير قابلة للاسترداد؛ أشارك على مسؤوليتي",
    "beta.consentRequired": "اقبل اتفاقية اختبار البيتا وإخلاء مسؤولية معاملات الحجز للانضمام.",
    "beta.successEyebrow": "برنامج البيتا",
    "beta.successTitle": "أنت مختبر بيتا في FLOQR",
    "beta.successAck": "تم تسجيل قبولك لاتفاقية اختبار بيتا لـ FloqR.app وإخلاء مسؤولية معاملات الحجز لهذا الحساب.",
    "beta.successStatus": "انضممت — تم قبول الاتفاقية وتسجيلها.",
    "beta.alreadyJoined": "لقد انضممت بالفعل إلى دعوة البيتا هذه.",
    "beta.goSearch": "افتح البحث لتجربة ميزات البيتا",
    "help.beta.title": "اختبار البيتا",
    "help.beta.body": "افتح هذه الدعوة وأنت مسجّل الدخول بنفس الحساب. اقرأ اتفاقية اختبار بيتا لـ FloqR.app، وفعّل المربعين الإلزاميين، ثم أوافق وأنضم إلى النسخة التجريبية. يظهر البحث بعد ذلك ميزاتك بتصنيف بيتا."
  }
};

const ORDER = [
  "beta.restoring", "beta.ready", "beta.agreementTitle", "beta.agreementSub",
  "beta.bookingTitle", "beta.bookingBody", "beta.checkAgreement", "beta.checkBooking",
  "beta.consentRequired", "beta.successEyebrow", "beta.successTitle", "beta.successAck",
  "beta.successStatus", "beta.alreadyJoined", "beta.goSearch", "help.beta.title", "help.beta.body"
];

function entriesBlock(pack) {
  return ORDER.map(key => `      ${JSON.stringify(key)}: ${JSON.stringify(pack[key])},`).join("\n");
}

const langOrder = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];

if (src.includes('"beta.consentRequired":')) {
  console.log("consent keys already present — skipping insert");
} else {
  let searchFrom = 0;
  for (const lang of langOrder) {
    const marker = `"beta.masterAdmin":`;
    const at = src.indexOf(marker, searchFrom);
    if (at < 0) throw new Error(`beta.masterAdmin missing for ${lang}`);
    const lineEnd = src.indexOf("\n", at);
    const insert = entriesBlock(PACKS[lang]);
    src = src.slice(0, lineEnd + 1) + insert + "\n" + src.slice(lineEnd + 1);
    searchFrom = lineEnd + 1 + insert.length;
  }
  console.log("inserted consent keys for", langOrder.length, "langs");
}

// Replace each beta.accept in occurrence order (CHROME packs).
let acceptFrom = 0;
for (const lang of langOrder) {
  const acceptKey = `"beta.accept":`;
  const acceptAt = src.indexOf(acceptKey, acceptFrom);
  if (acceptAt < 0) throw new Error(`beta.accept missing for ${lang}`);
  const acceptEnd = src.indexOf("\n", acceptAt);
  const newAccept = `      "beta.accept": ${JSON.stringify(ACCEPT[lang])},`;
  src = src.slice(0, acceptAt) + newAccept + src.slice(acceptEnd);
  acceptFrom = acceptAt + newAccept.length;
}
console.log("updated beta.accept for", langOrder.length, "langs");

// Fix French typo if present
src = src.replace("Lisez l’Accordo complet", "Lisez l’Accord complet");

fs.writeFileSync(file, src);
console.log("wrote", file);
