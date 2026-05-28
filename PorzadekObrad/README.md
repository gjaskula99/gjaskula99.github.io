# Porządek_Obrad_App

Statyczna aplikacja do planowania i prowadzenia spotkań. Działa w całości po stronie przeglądarki, bez backendu i bez procesu budowania, więc można ją hostować bezpośrednio na GitHub Pages.

## Uruchomienie

Otwórz `index.html` w przeglądarce albo opublikuj katalog jako stronę GitHub Pages. Aplikacja używa wyłącznie plików `index.html`, `styles.css` i `app.js`.

## Dane

Plan jest zapisywany w `localStorage` pod kluczem:

```text
porzadekObrad.plan.v1
```

Format danych:

```json
{
  "version": 1,
  "title": "Plan spotkania",
  "plannedStartTime": "09:00",
  "activeItemId": null,
  "items": [
    {
      "id": "unikalny-identyfikator",
      "parentId": null,
      "text": "Opis punktu",
      "durationMinutes": 10,
      "struck": false,
      "actualStartAt": null,
      "actualEndAt": null,
      "flowStatus": null,
      "sortOrder": 1
    }
  ]
}
```

Numeracja punktów, także zagnieżdżonych, jest wyliczana automatycznie podczas renderowania. Wykreślone punkty pozostają w planie, ale nie są doliczane do harmonogramu.
Faktyczne zakończenie punktu jest wyliczane jako faktyczny start plus długość punktu. Punkty oczekujące mają pustą komórkę faktycznego zakończenia i nie mają wyliczanego opóźnienia.

## Funkcje

- tabela z planowanymi i faktycznymi godzinami punktów obrad,
- automatyczne liczenie opóźnienia,
- sekwencyjne przechodzenie przez punkty spotkania,
- kompaktowy dolny panel z aktywnym punktem, automatycznym odliczaniem czasu punktu, opóźnieniem, planowanym zakończeniem i stoperem,
- niezależny stoper domyślnie ustawiony na minutę, z dźwiękiem i miganiem po zakończeniu odliczania,
- tryb edycji z paskiem akcji nad dolnym panelem sterowania dla zaznaczonego punktu: dodawaniem punktów i podpunktów, oznaczaniem jako oczekujący, usuwaniem, czyszczeniem całej agendy, wykreślaniem, przesuwaniem oraz zmianą poziomu punkt/podpunkt,
- edycja tytułu spotkania tylko po wejściu w edycję,
- edycja planowanej godziny rozpoczęcia tylko po wejściu w edycję,
- przypięty tytuł spotkania i czas lokalny u góry ekranu podczas przewijania,
- cofanie do poprzedniego punktu oznacza przywrócony punkt jako `Przywrócony`, a punkt opuszczony jako `Odroczony`,
- przejście dalej z ostatniego aktywnego punktu kończy go i zatrzymuje bieżące liczniki opóźnień,
- eksport i import całego planu przez JSON,
- zapis do PDF przez przycisk `PDF`, który uruchamia natywne drukowanie przeglądarki.

## GitHub Pages

Repozytorium nie wymaga instalacji zależności. W ustawieniach GitHub Pages wystarczy wskazać gałąź i katalog zawierający te pliki. Wszystkie ścieżki są względne, więc aplikacja działa także w podkatalogu projektu.
