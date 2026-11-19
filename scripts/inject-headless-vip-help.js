#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const HELP = {
  ru: {
    "help-botdee-room-smartview": {
      title: "Room SMARTview",
      body: "В чате BOT DEE скажите Open Room SMARTview или Start a group chat. Confirm создаёт ссылку для друзей, которые вошли в аккаунт. Вход в room — не платёж и не открывает общий счёт. BOT DEE никогда не берёт номера карт. Личные сообщения остаются личными. Site Chrome следует теме Appearance."
    },
    "help-botdee-room-smartview-invite": {
      title: "Приглашение Room SMARTview",
      body: "После Confirm поделитесь ссылкой Room SMARTview. Имена не ищутся только потому, что вы их набрали — FLOQR не скажет, существует ли аккаунт. Вход — не платёж и не открывает общий счёт."
    },
    "help-botdee-room-smartview-join": {
      title: "Войти в Room SMARTview",
      body: "Откройте ссылку Room SMARTview, войдя в аккаунт, или вставьте её в BOT DEE. Вход в room — не вход в общий счёт и не одобрение платежа. BOT DEE никогда не берёт номера карт."
    },
    "help-botdee-room-smartview-end": {
      title: "Завершить Room SMARTview",
      body: "Только хост может завершить room и только после подтверждения. Завершение никого не списывает и не стирает чужие личные чаты."
    },
    "help-botdee-headless-vip": {
      title: "VIP reserV из чата BOT DEE",
      body: "Скажите VIP reserV или hold a VIP table at Aurelia в BOT DEE. Назовите клуб, вечер и стол или зону. Mezzanine — зона: BOT DEE перечислит V1–V4 и AURELIA SUITE, затем hold it, I agree к Terms и оплата, если нужен депозит. BOT DEE никогда не берёт номера карт. Вход в Room SMARTview — не платёж."
    }
  },
  nl: {
    "help-botdee-room-smartview": {
      title: "Room SMARTview",
      body: "Zeg in BOT DEE-chat Open Room SMARTview of Start a group chat. Confirm maakt een join-link voor ingelogde vrienden. Deelnemen is geen betaling en opent geen shared tab. BOT DEE neemt nooit kaartnummers. Privéberichten blijven privé. Site Chrome volgt Appearance."
    },
    "help-botdee-room-smartview-invite": {
      title: "Room SMARTview-uitnodiging",
      body: "Deel na Confirm de Room SMARTview-link. Namen worden niet opgezocht alleen omdat je ze typt — FLOQR zegt niet of een account bestaat. Deelnemen is geen betaling en opent geen shared tab."
    },
    "help-botdee-room-smartview-join": {
      title: "Deelnemen aan Room SMARTview",
      body: "Open een Room SMARTview-link terwijl je bent ingelogd, of plak die in BOT DEE. Deelnemen aan de room is geen shared tab en keurt geen betaling goed. BOT DEE neemt nooit kaartnummers."
    },
    "help-botdee-room-smartview-end": {
      title: "Room SMARTview beëindigen",
      body: "Alleen de host kan een room beëindigen, en alleen na bevestiging. Beëindigen belast niemand en wist andermans privéchats niet."
    },
    "help-botdee-headless-vip": {
      title: "VIP reserV vanuit BOT DEE-chat",
      body: "Zeg VIP reserV of hold a VIP table at Aurelia in BOT DEE. Noem club, avond en tafel of zone. Mezzanine is een zone — BOT DEE toont V1–V4 en AURELIA SUITE. Daarna hold it, I agree bij Terms, en betalen als er een deposit nodig is. BOT DEE neemt nooit kaartnummers. Deelnemen aan Room SMARTview is geen betaling."
    }
  },
  fr: {
    "help-botdee-room-smartview": {
      title: "Room SMARTview",
      body: "Dans le chat BOT DEE, dites Open Room SMARTview ou Start a group chat. Confirm crée un lien pour les amis connectés. Rejoindre n’est pas un paiement et n’ouvre pas un compte partagé. BOT DEE ne prend jamais de numéros de carte. Les messages privés restent privés. Site Chrome suit Appearance."
    },
    "help-botdee-room-smartview-invite": {
      title: "Invitation Room SMARTview",
      body: "Après Confirm, partagez le lien Room SMARTview. Les noms ne sont pas recherchés juste parce que vous les tapez — FLOQR ne dira pas si un compte existe. Rejoindre n’est pas un paiement et n’ouvre pas un compte partagé."
    },
    "help-botdee-room-smartview-join": {
      title: "Rejoindre un Room SMARTview",
      body: "Ouvrez un lien Room SMARTview en étant connecté, ou collez-le dans BOT DEE. Rejoindre la room n’est pas rejoindre un compte partagé et n’approuve pas un paiement. BOT DEE ne prend jamais de numéros de carte."
    },
    "help-botdee-room-smartview-end": {
      title: "Terminer Room SMARTview",
      body: "Seul l’hôte peut terminer une room, et seulement après confirmation. Terminer ne facture personne et n’efface pas les chats privés des autres."
    },
    "help-botdee-headless-vip": {
      title: "VIP reserV depuis le chat BOT DEE",
      body: "Dites VIP reserV ou hold a VIP table at Aurelia dans BOT DEE. Nommez le club, la soirée et la table ou la zone. Mezzanine est une zone — BOT DEE liste V1–V4 et AURELIA SUITE. Puis hold it, I agree aux Terms, et payez si un dépôt est requis. BOT DEE ne prend jamais de numéros de carte. Rejoindre un Room SMARTview n’est pas un paiement."
    }
  },
  de: {
    "help-botdee-room-smartview": {
      title: "Room SMARTview",
      body: "Sagen Sie im BOT DEE-Chat Open Room SMARTview oder Start a group chat. Confirm erzeugt einen Join-Link für angemeldete Freunde. Beitreten ist keine Zahlung und öffnet kein Shared Tab. BOT DEE nimmt nie Kartennummern. Private Nachrichten bleiben privat. Site Chrome folgt Appearance."
    },
    "help-botdee-room-smartview-invite": {
      title: "Room SMARTview-Einladung",
      body: "Teilen Sie nach Confirm den Room SMARTview-Link. Namen werden nicht nachgeschlagen, nur weil Sie sie tippen — FLOQR sagt nicht, ob ein Konto existiert. Beitreten ist keine Zahlung und öffnet kein Shared Tab."
    },
    "help-botdee-room-smartview-join": {
      title: "Room SMARTview beitreten",
      body: "Öffnen Sie einen Room SMARTview-Link angemeldet oder fügen Sie ihn in BOT DEE ein. Der Room-Beitritt ist kein Shared Tab und genehmigt keine Zahlung. BOT DEE nimmt nie Kartennummern."
    },
    "help-botdee-room-smartview-end": {
      title: "Room SMARTview beenden",
      body: "Nur der Host kann einen Room beenden, und nur nach Bestätigung. Beenden belastet niemanden und löscht fremde private Chats nicht."
    },
    "help-botdee-headless-vip": {
      title: "VIP reserV aus dem BOT DEE-Chat",
      body: "Sagen Sie VIP reserV oder hold a VIP table at Aurelia in BOT DEE. Nennen Sie Club, Abend und Tisch oder Bereich. Mezzanine ist ein Bereich — BOT DEE listet V1–V4 und AURELIA SUITE. Dann hold it, I agree zu Terms, und zahlen, wenn eine Kaution nötig ist. BOT DEE nimmt nie Kartennummern. Room SMARTview beitreten ist keine Zahlung."
    }
  },
  es: {
    "help-botdee-room-smartview": {
      title: "Room SMARTview",
      body: "En el chat de BOT DEE, di Open Room SMARTview o Start a group chat. Confirm crea un enlace para amigos con sesión iniciada. Unirse no es un pago y no abre una cuenta compartida. BOT DEE nunca pide números de tarjeta. Los mensajes privados siguen privados. Site Chrome sigue Appearance."
    },
    "help-botdee-room-smartview-invite": {
      title: "Invitación Room SMARTview",
      body: "Tras Confirm, comparte el enlace de Room SMARTview. Los nombres no se buscan solo porque los escribas — FLOQR no dirá si existe una cuenta. Unirse no es un pago y no abre una cuenta compartida."
    },
    "help-botdee-room-smartview-join": {
      title: "Unirse a un Room SMARTview",
      body: "Abre un enlace de Room SMARTview con la sesión iniciada, o pégalo en BOT DEE. Unirse a la room no une a una cuenta compartida ni aprueba un pago. BOT DEE nunca pide números de tarjeta."
    },
    "help-botdee-room-smartview-end": {
      title: "Terminar Room SMARTview",
      body: "Solo el anfitrión puede terminar una room, y solo tras confirmar. Terminar no cobra a nadie ni borra los chats privados de otras personas."
    },
    "help-botdee-headless-vip": {
      title: "VIP reserV desde el chat de BOT DEE",
      body: "Di VIP reserV o hold a VIP table at Aurelia en BOT DEE. Nombra el club, la noche y la mesa o zona. Mezzanine es una zona: BOT DEE lista V1–V4 y AURELIA SUITE. Luego hold it, I agree a Terms, y paga si hay depósito. BOT DEE nunca pide números de tarjeta. Unirse a Room SMARTview no es un pago."
    }
  },
  it: {
    "help-botdee-room-smartview": {
      title: "Room SMARTview",
      body: "Nella chat BOT DEE di’ Open Room SMARTview o Start a group chat. Confirm crea un link per gli amici connessi. Entrare non è un pagamento e non apre un tab condiviso. BOT DEE non prende mai numeri di carta. I messaggi privati restano privati. Site Chrome segue Appearance."
    },
    "help-botdee-room-smartview-invite": {
      title: "Invito Room SMARTview",
      body: "Dopo Confirm condividi il link Room SMARTview. I nomi non vengono cercati solo perché li digiti — FLOQR non dirà se un account esiste. Entrare non è un pagamento e non apre un tab condiviso."
    },
    "help-botdee-room-smartview-join": {
      title: "Entra in un Room SMARTview",
      body: "Apri un link Room SMARTview da connesso, o incollalo in BOT DEE. Entrare nella room non è entrare in un tab condiviso e non approva un pagamento. BOT DEE non prende mai numeri di carta."
    },
    "help-botdee-room-smartview-end": {
      title: "Termina Room SMARTview",
      body: "Solo l’host può terminare una room, e solo dopo la conferma. Terminare non addebita nessuno e non cancella le chat private altrui."
    },
    "help-botdee-headless-vip": {
      title: "VIP reserV dalla chat BOT DEE",
      body: "Di’ VIP reserV o hold a VIP table at Aurelia in BOT DEE. Indica club, serata e tavolo o zona. Mezzanine è una zona: BOT DEE elenca V1–V4 e AURELIA SUITE. Poi hold it, I agree ai Terms, e paga se serve un deposito. BOT DEE non prende mai numeri di carta. Entrare in Room SMARTview non è un pagamento."
    }
  },
  pt: {
    "help-botdee-room-smartview": {
      title: "Room SMARTview",
      body: "No chat BOT DEE, diga Open Room SMARTview ou Start a group chat. Confirm cria um link para amigos com sessão iniciada. Entrar não é um pagamento e não abre um tab partilhado. BOT DEE nunca pede números de cartão. Mensagens privadas ficam privadas. Site Chrome segue Appearance."
    },
    "help-botdee-room-smartview-invite": {
      title: "Convite Room SMARTview",
      body: "Depois de Confirm, partilhe o link Room SMARTview. Nomes não são pesquisados só porque os escreveu — FLOQR não dirá se uma conta existe. Entrar não é um pagamento e não abre um tab partilhado."
    },
    "help-botdee-room-smartview-join": {
      title: "Entrar num Room SMARTview",
      body: "Abra um link Room SMARTview com sessão iniciada, ou cole-o no BOT DEE. Entrar na room não entra num tab partilhado e não aprova um pagamento. BOT DEE nunca pede números de cartão."
    },
    "help-botdee-room-smartview-end": {
      title: "Terminar Room SMARTview",
      body: "Só o anfitrião pode terminar uma room, e só após confirmar. Terminar não cobra ninguém nem apaga chats privados de outras pessoas."
    },
    "help-botdee-headless-vip": {
      title: "VIP reserV a partir do chat BOT DEE",
      body: "Diga VIP reserV ou hold a VIP table at Aurelia no BOT DEE. Nomeie o clube, a noite e a mesa ou zona. Mezzanine é uma zona — BOT DEE lista V1–V4 e AURELIA SUITE. Depois hold it, I agree aos Terms, e pague se houver depósito. BOT DEE nunca pede números de cartão. Entrar num Room SMARTview não é um pagamento."
    }
  },
  el: {
    "help-botdee-room-smartview": {
      title: "Room SMARTview",
      body: "Στη συνομιλία BOT DEE πείτε Open Room SMARTview ή Start a group chat. Το Confirm δημιουργεί σύνδεσμο για συνδεδεμένους φίλους. Η είσοδος δεν είναι πληρωμή και δεν ανοίγει κοινό λογαριασμό. Το BOT DEE δεν παίρνει ποτέ αριθμούς καρτών. Τα ιδιωτικά μηνύματα μένουν ιδιωτικά. Το Site Chrome ακολουθεί Appearance."
    },
    "help-botdee-room-smartview-invite": {
      title: "Πρόσκληση Room SMARTview",
      body: "Μετά το Confirm μοιραστείτε τον σύνδεσμο Room SMARTview. Τα ονόματα δεν αναζητούνται μόνο επειδή τα πληκτρολογήσατε — το FLOQR δεν θα πει αν υπάρχει λογαριασμός. Η είσοδος δεν είναι πληρωμή και δεν ανοίγει κοινό λογαριασμό."
    },
    "help-botdee-room-smartview-join": {
      title: "Μπείτε σε Room SMARTview",
      body: "Ανοίξτε σύνδεσμο Room SMARTview ενώ είστε συνδεδεμένοι, ή επικολλήστε τον στο BOT DEE. Η είσοδος στο room δεν είναι είσοδος σε κοινό λογαριασμό και δεν εγκρίνει πληρωμή. Το BOT DEE δεν παίρνει ποτέ αριθμούς καρτών."
    },
    "help-botdee-room-smartview-end": {
      title: "Τερματισμός Room SMARTview",
      body: "Μόνο ο οικοδεσπότης μπορεί να κλείσει ένα room, και μόνο μετά από επιβεβαίωση. Ο τερματισμός δεν χρεώνει κανέναν και δεν σβήνει ιδιωτικές συνομιλίες άλλων."
    },
    "help-botdee-headless-vip": {
      title: "VIP reserV από τη συνομιλία BOT DEE",
      body: "Πείτε VIP reserV ή hold a VIP table at Aurelia στο BOT DEE. Ονομάστε club, βραδιά και τραπέζι ή ζώνη. Το Mezzanine είναι ζώνη — το BOT DEE δείχνει V1–V4 και AURELIA SUITE. Έπειτα hold it, I agree στους Terms, και πληρωμή αν χρειάζεται κατάθεση. Το BOT DEE δεν παίρνει ποτέ αριθμούς καρτών. Η είσοδος σε Room SMARTview δεν είναι πληρωμή."
    }
  },
  pl: {
    "help-botdee-room-smartview": {
      title: "Room SMARTview",
      body: "W czacie BOT DEE powiedz Open Room SMARTview lub Start a group chat. Confirm tworzy link dla zalogowanych znajomych. Dołączenie nie jest płatnością i nie otwiera wspólnego rachunku. BOT DEE nigdy nie bierze numerów kart. Prywatne wiadomości zostają prywatne. Site Chrome podąża za Appearance."
    },
    "help-botdee-room-smartview-invite": {
      title: "Zaproszenie Room SMARTview",
      body: "Po Confirm udostępnij link Room SMARTview. Imiona nie są wyszukiwane tylko dlatego, że je wpiszesz — FLOQR nie powie, czy konto istnieje. Dołączenie nie jest płatnością i nie otwiera wspólnego rachunku."
    },
    "help-botdee-room-smartview-join": {
      title: "Dołącz do Room SMARTview",
      body: "Otwórz link Room SMARTview będąc zalogowanym albo wklej go w BOT DEE. Dołączenie do room nie jest dołączeniem do wspólnego rachunku i nie zatwierdza płatności. BOT DEE nigdy nie bierze numerów kart."
    },
    "help-botdee-room-smartview-end": {
      title: "Zakończ Room SMARTview",
      body: "Tylko gospodarz może zakończyć room i tylko po potwierdzeniu. Zakończenie nikogo nie obciąża i nie kasuje prywatnych czatów innych osób."
    },
    "help-botdee-headless-vip": {
      title: "VIP reserV z czatu BOT DEE",
      body: "Powiedz VIP reserV albo hold a VIP table at Aurelia w BOT DEE. Podaj klub, wieczór i stolik lub strefę. Mezzanine to strefa — BOT DEE wymieni V1–V4 i AURELIA SUITE. Potem hold it, I agree do Terms i zapłać, jeśli potrzebna jest kaucja. BOT DEE nigdy nie bierze numerów kart. Dołączenie do Room SMARTview nie jest płatnością."
    }
  },
  ar: {
    "help-botdee-room-smartview": {
      title: "Room SMARTview",
      body: "في محادثة BOT DEE قل Open Room SMARTview أو Start a group chat. Confirm ينشئ رابط انضمام للأصدقاء المسجّلين. الانضمام ليس دفعاً ولا يفتح حساباً مشتركاً. BOT DEE لا يأخذ أرقام البطاقات أبداً. الرسائل الخاصة تبقى خاصة. Site Chrome يتبع Appearance."
    },
    "help-botdee-room-smartview-invite": {
      title: "دعوة Room SMARTview",
      body: "بعد Confirm شارك رابط Room SMARTview. الأسماء لا تُبحث فقط لأنك كتبتها — FLOQR لن يقول إن كان الحساب موجوداً. الانضمام ليس دفعاً ولا يفتح حساباً مشتركاً."
    },
    "help-botdee-room-smartview-join": {
      title: "الانضمام إلى Room SMARTview",
      body: "افتح رابط Room SMARTview وأنت مسجّل الدخول، أو الصقه في BOT DEE. الانضمام إلى room ليس انضماماً إلى حساب مشترك ولا يوافق على دفع. BOT DEE لا يأخذ أرقام البطاقات أبداً."
    },
    "help-botdee-room-smartview-end": {
      title: "إنهاء Room SMARTview",
      body: "المضيف فقط يمكنه إنهاء room وبعد التأكيد فقط. الإنهاء لا يحاسب أحداً ولا يمسح محادثات الآخرين الخاصة."
    },
    "help-botdee-headless-vip": {
      title: "VIP reserV من محادثة BOT DEE",
      body: "قل VIP reserV أو hold a VIP table at Aurelia في BOT DEE. اذكر النادي والليلة والطاولة أو المنطقة. Mezzanine منطقة — BOT DEE يعرض V1–V4 وAURELIA SUITE. ثم hold it وI agree لـ Terms وادفع إن لزم عربون. BOT DEE لا يأخذ أرقام البطاقات. الانضمام إلى Room SMARTview ليس دفعاً."
    }
  }
};

function replaceHelpBlock(src, id, title, body) {
  const re = new RegExp(
    `"${id}": \\{\\s*title: "(?:\\\\.|[^"\\\\])*",\\s*body: "(?:\\\\.|[^"\\\\])*"`
  );
  const neu = `"${id}": {\n        title: ${JSON.stringify(title)},\n        body: ${JSON.stringify(body)}`;
  if (!re.test(src)) throw new Error(`missing ${id}`);
  return src.replace(re, neu);
}

function insertAfter(src, afterId, id, title, body) {
  if (src.includes(`"${id}":`)) return src;
  const re = new RegExp(
    `("${afterId}": \\{\\s*title: "(?:\\\\.|[^"\\\\])*",\\s*body: "(?:\\\\.|[^"\\\\])*"\\s*\\})`
  );
  const hit = src.match(re);
  if (!hit) throw new Error(`insert after missing ${afterId}`);
  const block = `${hit[1]},\n      "${id}": {\n        title: ${JSON.stringify(title)},\n        body: ${JSON.stringify(body)}\n      }`;
  return src.replace(re, block);
}

const helpFile = path.join(__dirname, "..", "floqr-i18n-help.js");
let src = fs.readFileSync(helpFile, "utf8");
const order = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];
order.forEach(lang => {
  const pack = HELP[lang];
  Object.entries(pack).forEach(([id, row]) => {
    if (id === "help-botdee-headless-vip") return;
    src = replaceHelpBlock(src, id, row.title, row.body);
  });
});
// Insert new help id once per pack (10 langs)
let inserted = 0;
src = src.replace(
  /("help-shoutout-headless-smartview": \{\s*title: "(?:\\.|[^"\\])*",\s*body: "(?:\\.|[^"\\])*"\s*\})/g,
  (full, block, offset) => {
    const slice = src.slice(offset, offset + 800);
    if (slice.includes("help-botdee-headless-vip")) return full;
    const lang = order[inserted];
    inserted += 1;
    const row = HELP[lang]["help-botdee-headless-vip"];
    return `${block},\n      "help-botdee-headless-vip": {\n        title: ${JSON.stringify(row.title)},\n        body: ${JSON.stringify(row.body)}\n      }`;
  }
);
if (inserted !== 10) {
  console.error("expected 10 vip help inserts, got", inserted);
  process.exit(1);
}
fs.writeFileSync(helpFile, src);

const en = path.join(__dirname, "_help-en.json");
const json = JSON.parse(fs.readFileSync(en, "utf8"));
json["help-botdee-room-smartview"] = {
  title: "Room SMARTview",
  body: "In BOT DEE chat, say Open Room SMARTview or Start a group chat. Confirm mints a join link friends can open while signed in. Joining is not a payment and does not open a shared tab. BOT DEE never takes card numbers. Private BOT DEE messages stay private. Site Chrome follows your Appearance theme."
};
json["help-botdee-room-smartview-invite"] = {
  title: "Room SMARTview invite",
  body: "After you confirm Room SMARTview, share the join link. Named people are not looked up just because you typed a name — FLOQR will not say whether an account exists. Joining is not a payment and does not open a shared tab."
};
json["help-botdee-room-smartview-join"] = {
  title: "Join a Room SMARTview",
  body: "Open a Room SMARTview join link while signed in, or paste it in BOT DEE. Joining the room is not joining a shared tab and does not approve a payment. BOT DEE never takes card numbers."
};
json["help-botdee-room-smartview-end"] = {
  title: "End Room SMARTview",
  body: "Only the host can end a room, and only after confirm. Ending does not charge anyone or erase other people’s private chats."
};
json["help-botdee-headless-vip"] = {
  title: "VIP reserV from BOT DEE chat",
  body: "Say VIP reserV or hold a VIP table at Aurelia in BOT DEE. Name the club, night, and table or area. Mezzanine is an area — BOT DEE lists V1–V4 and AURELIA SUITE so you can pick a table, then hold it, reply I agree to Terms, and pay if a deposit is required. BOT DEE never takes card numbers. Joining a Room SMARTview is not a payment."
};
fs.writeFileSync(en, `${JSON.stringify(json, null, 2)}\n`);
console.log("updated floqr-i18n-help.js + _help-en.json");
