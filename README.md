# n8n-nodes-przypominamy

Oficjalny węzeł [n8n](https://n8n.io) dla [API SMS przypominamy.com](https://przypominamy.com/api) — polskiej bramki SMS. Wysyłaj SMS-y i wiadomości głosowe, zarządzaj kontaktami, grupami i czarną listą, pobieraj raporty, a status doręczenia odbieraj webhookiem z podpisem HMAC — bez pisania kodu.

Pakiet zawiera:

- **Przypominamy.com SMS** — węzeł akcji (zasoby: Wiadomość, Kontakt, Grupa, Czarna lista, Konto, Szablon), 1:1 z REST API v2; działa też jako narzędzie agenta AI (`usableAsTool`).
- **Przypominamy.com Trigger** — węzeł webhooka: statusy doręczeń, odpowiedzi odbiorców (2-way), kliknięcia w śledzone linki. Weryfikuje podpis `X-Przypominamy-Signature`.
- **Przypominamy.com API** — dane dostępowe (klucz API, opcjonalny sekret webhooka).

Pełna dokumentacja integracji: [przypominamy.com/integracje/n8n](https://przypominamy.com/integracje/n8n) · referencja API: [przypominamy.com/api/docs](https://przypominamy.com/api/docs).

## Instalacja

**Self-hosted:** *Settings → Community Nodes → Install*, wpisz `n8n-nodes-przypominamy@1.1.0`, zaakceptuj i zainstaluj. Po chwili w wyszukiwarce węzłów pojawią się „Przypominamy.com SMS” i „Przypominamy.com Trigger”.

**Ręcznie (Docker / npm):**

```bash
cd ~/.n8n/nodes          # katalog węzłów społeczności (N8N_USER_FOLDER/nodes)
npm install n8n-nodes-przypominamy@1.1.0
# restart n8n
```

Wymagania: n8n ≥ 1.0, Node.js ≥ 18.10.

Pole *Cel wysyłki (purpose)* jest dostępne w wersji 1.1.0. W wersji 1.0.0 oraz w n8n Cloud możesz wysyłać SMS-y przez wbudowany [HTTP Request](https://przypominamy.com/integracje/n8n#konfiguracja) z `purpose` w treści JSON. Bramka wymaga tego pola dla kont objętych ochroną nowych kont.

## Dane dostępowe

1. Zaloguj się do panelu [app.przypominamy.com](https://app.przypominamy.com) (rejestracja: [przypominamy.com/register](https://przypominamy.com/register)).
2. W zakładce [Klucze API](https://app.przypominamy.com/keys) utwórz klucz z zakresami `send` i `read` (do kontaktów, grup i czarnej listy także `manage`). Klucz `pk_test_…` na koncie testowym wysyła tylko na zweryfikowane numery i nie pobiera opłat.
3. W n8n: *Credentials → Add credential → Przypominamy.com API* → wklej klucz. Przycisk *Test* wywołuje `GET /v1/account`.
4. (Dla triggera) w panelu [Webhook](https://app.przypominamy.com/webhook) wklej adres z węzła Trigger i skopiuj wyświetlony sekret `whsec_…` do pola *Sekret Webhooka* w tych samych danych dostępowych.

## Węzeł „Przypominamy.com SMS”

| Zasób | Operacje | Endpoint |
|---|---|---|
| Wiadomość | Wyślij SMS · Wyślij wiadomość głosową · Pobierz · Lista · Anuluj | `POST /v1/messages`, `POST /v1/voice`, `GET /v1/messages/{id}`, `GET /v1/messages`, `DELETE /v1/messages/{id}` |
| Kontakt | Dodaj lub zaktualizuj · Lista · Usuń | `POST /v1/contacts`, `GET /v1/contacts`, `DELETE /v1/contacts/{id}` |
| Grupa | Lista · Utwórz · Dodaj kontakty | `GET/POST /v1/groups`, `POST /v1/groups/{id}/contacts` |
| Czarna lista | Dodaj · Usuń · Lista | `POST /v1/blacklist`, `DELETE /v1/blacklist/{msisdn}`, `GET /v1/blacklist` |
| Konto | Pobierz konto · Nadpisy · Raport · Sprawdź numer (HLR) | `GET /v1/account`, `GET /v1/senders`, `GET /v1/reports`, `GET /v1/numbers/{msisdn}/lookup` |
| Szablon | Lista | `GET /v1/templates` |

**Wyślij SMS** — pola:

- *Odbiorca (to)*: numer `+48600100200`, kilka numerów po przecinku (do 500) albo grupa `group:VIP`. Przy `group:` działa personalizacja z książki kontaktów: `{{imie}}`, `{{nazwisko}}`, `{{email}}`, `{{pole_wlasne}}`.
- *Treść*: tekst SMS. Placeholdery `{{opt_out}}` (link wypisu) i `{{link:https://…}}` (link śledzony, do 2 na wiadomość).
- *Pola dodatkowe*: cel wysyłki (`purpose`, od 5 do 200 znaków), nadawca (`from`), zaplanowana wysyłka (`send_at`, do 90 dni), okno godzin (`send_window`, np. `08:00-20:00`), ważność (`expires_at`, 15 min – 72 h), referencja, SMS priorytetowy (`priority`, cena ×2), szablon (`template_id` + `params` JSON) zamiast treści, klucz idempotencji (`Idempotency-Key`).

Odpowiedź to rekord wiadomości (`id`, `status`, `parts`, `cost_grosze`, …) albo dla wielu odbiorców `{ count, accepted, total_cost_grosze, messages: [...] }`. Kwoty w groszach.

**Błędy** API (`{ error: { code, message, param } }`) są pokazywane w n8n jako komunikat z kodem, polem i `request_id`. Włącz *Settings → On Error → Continue* w węźle, żeby błąd jednego elementu (np. `insufficient_funds`, numer na czarnej liście) nie zatrzymał całego workflow — element dostanie wtedy pola `error`, `description`, `httpCode`.

## Węzeł „Przypominamy.com Trigger”

1. Dodaj węzeł, wybierz zdarzenia (domyślnie: doręczona, niedoręczona, błąd, wygasła; dostępne też `message.sent`, `message.received`, `link.clicked`).
2. Skopiuj *Production URL* (widoczny u góry węzła) i wklej w panelu **Webhook**. Sekret z panelu wpisz w danych dostępowych.
3. Aktywuj workflow. Każde zdarzenie trafia na wyjście jako `{ id, type, created_at, data }` — dla statusów `data.message` to pełny rekord wiadomości (z `reference`, dzięki któremu połączysz status z rekordem w swoim systemie). Opcja *Tylko dane zdarzenia* spłaszcza to do samego `data` z polem `event`.

Podpis: `X-Przypominamy-Signature: t=<unix>,v1=<hex>`, gdzie `v1 = HMAC-SHA256(sekret, "<t>.<surowe body>")`. Węzeł odrzuca (`401`) wywołania bez poprawnego podpisu albo starsze niż 5 minut; zdarzenia spoza wybranej listy potwierdza `200`, ale nie uruchamia workflow (bramka nie ponawia). Weryfikację można wyłączyć w *Opcjach* — tylko do testów.

## Przykładowe workflow

### 1. Przypomnienie o wizycie z Google Sheets

Arkusz z kolumnami `telefon`, `imie`, `data_wizyty`, `godzina`. Codziennie o 18:00 wysyłamy przypomnienie na jutro.

```
Schedule Trigger (18:00)
  → Google Sheets: Get rows (filter: data_wizyty = {{ $today.plus(1,'day').toFormat('yyyy-MM-dd') }})
  → Przypominamy.com SMS: Wiadomość → Wyślij SMS
       to:        {{ $json.telefon }}
       text:      Dzień dobry {{ $json.imie }}, przypominamy o wizycie jutro o {{ $json.godzina }}. Odwołanie: tel. 22 000 00 00.
       purpose:   przypomnienie o wizycie
       reference: wizyta-{{ $json.id }}
       from:      PRZYPOMINAM   (albo własny nadpis z panelu)
  → Google Sheets: Update row (kolumna sms_id ← {{ $json.id }}, status ← {{ $json.status }})
```

Wskazówka: w polu *Okno godzin* ustaw `08:00-20:00`, a *Klucz idempotencji* na `wizyta-{{ $json.id }}-{{ $json.data_wizyty }}` — ponowne uruchomienie workflow nie wyśle SMS-a drugi raz.

### 2. Potwierdzenie zamówienia z WooCommerce

```
WooCommerce Trigger (order.created)
  → IF: {{ $json.billing.phone }} nie jest puste
  → Przypominamy.com SMS: Wiadomość → Wyślij SMS
       to:        {{ $json.billing.phone }}
       text:      {{ $json.billing.first_name }}, dziękujemy za zamówienie #{{ $json.id }} na {{ $json.total }} zł. Status sprawdzisz: {{link:{{ $json.order_url }}}}
       purpose:   potwierdzenie zamówienia
       reference: order-{{ $json.id }}
       priority:  true   (opcjonalnie — potwierdzenia dochodzą szybciej)
```

Kolejne workflow z tym samym wzorcem można podpiąć pod `order.updated` (status `completed` → „Zamówienie wysłane, numer przesyłki …”).

### 3. Status doręczenia do Slacka

```
Przypominamy.com Trigger (message.undelivered, message.failed, message.expired)
  → Slack: Send message (#sms-alerty)
       :warning: SMS {{ $json.data.message.id }} do {{ $json.data.message.to }} — {{ $json.type }}
       ref: {{ $json.data.message.reference }} · błąd: {{ $json.data.message.error ?? 'brak' }}
```

Analogicznie `message.delivered` → aktualizacja rekordu w CRM po `reference`, a `message.received` (odpowiedź klienta, 2-way) → ticket w helpdesku; `data.opt_out = true` oznacza, że odbiorca wysłał STOP i trafił na czarną listę.

## Rozwój pakietu

```bash
npm install
npm run build      # tsc → dist/ + kopiowanie ikon
npm run lint       # eslint-plugin-n8n-nodes-base (konfiguracja dostosowana do polskiego interfejsu)
npm run dev        # tsc --watch
```

Test lokalny: `npm link` w tym katalogu, potem `npm link n8n-nodes-przypominamy` w `~/.n8n/nodes` i restart n8n.

Zgłoszenia błędów: [support@przypominamy.com](mailto:support@przypominamy.com) lub issues w repozytorium. Licencja MIT.

---

## English

**n8n community node for [przypominamy.com](https://przypominamy.com/api)** — a Polish SMS gateway with a simple REST API (SMS, voice/TTS, contacts, groups, blacklist, reports, HMAC-signed webhooks).

- **Install (self-hosted):** n8n *Settings → Community Nodes → Install* → `n8n-nodes-przypominamy@1.1.0`. To send from n8n Cloud or version 1.0.0, use the built-in [HTTP Request node](https://przypominamy.com/integracje/n8n#konfiguracja) with `purpose` in the JSON body. The gateway requires this field for accounts covered by its new-account safeguards.
- **Credentials:** create an API key at [app.przypominamy.com/keys](https://app.przypominamy.com/keys) (`pk_live_…`; `pk_test_…` keys only send to verified numbers). Add it as *Przypominamy.com API*; the test button calls `GET /v1/account`. For the trigger, paste the node's production webhook URL at [app.przypominamy.com/webhook](https://app.przypominamy.com/webhook) and copy the shown `whsec_…` secret into the credential.
- **Action node** *Przypominamy.com SMS*: Message (send SMS, send voice, get, list, cancel), Contact (upsert, list, delete), Group (list, create, add contacts), Blacklist (add, remove, list), Account (get, senders, report, HLR lookup), Template (list). Recipients accept a single number, a comma-separated list (up to 500) or `group:Name`. API errors surface as `NodeApiError` with the error code, offending parameter and `request_id`; *Continue on Fail* is supported.
- **Trigger node** *Przypominamy.com Trigger*: receives `message.sent|delivered|undelivered|failed|expired|received` and `link.clicked` webhooks, verifies `X-Przypominamy-Signature` (`t=<unix>,v1=<hex>`, `v1 = HMAC-SHA256(secret, "<t>.<raw body>")`, 5-minute window) and emits the JSON payload.

Docs: [przypominamy.com/integracje/n8n](https://przypominamy.com/integracje/n8n) · API reference: [przypominamy.com/api/docs](https://przypominamy.com/api/docs). MIT license.
