# Signs

A personal flashcard app for learning ASL vocabulary. It is built on the same engine as Mémot:
spaced repetition with the FSRS scheduler, no limits and no subscriptions. Each card holds a
**sign video** and the **English** word.

## Features

- **Sign video cards.** Add a video from **Photos** (with a trim screen so you keep only the sign),
  record one with the **Camera**, pick a file from **Files**, or paste a **Link**.
- **Links instead of copies.** A YouTube link plays right on the card through YouTube's own player,
  so nothing is downloaded. Add a start time (`?t=1m05s`, and `&end=70` if you like) to jump
  straight to the sign in a longer video. A direct video link (`.mp4`) also plays on the card. Other
  sites (e.g. Signing Savvy) show a button that opens the page in Safari.
- **Video controls on every card:** pause, replay, speed (1× → ¾× → ½×), and mirror, which flips
  the signer like a mirror. Videos loop silently. The default speed and mirror are in Settings → Sign videos.
- **Two ways to practise** (Deck options → Practise):
  - **Recognise:** watch the sign, recall the English.
  - **Produce:** see the English, sign it yourself, then check the video.
  - **Both** is the default.
- **Fast adding for class.** The lesson tag (e.g. `unit3`) is kept from card to card, so a whole
  unit goes in quickly. Optional notes (e.g. a handshape hint) can go with the video.
- **Import a list.** A text/CSV file with one card per line: `link, English, tags`. A link in the
  first column becomes the sign video.
- Everything else from Mémot: decks, daily goal, Again / Hard / Good / Easy with intervals, undo,
  bury, suspend, the Mistakes list, statistics, streaks, study calendar, a daily reminder, and
  backup / restore.

Videos saved in the app are part of the backup zip. Links aren't files, so they need the internet
to play, and a card stops working if the video is taken down.

**Personal use only.** Links play videos from their original sites. Only save copies of videos
you're allowed to keep: your own recordings, or clips your teacher shared with you.

## Installing on the iPhone (free, no App Store)

Every push to `main` (or to a `claude/…` work branch) builds the app on GitHub and publishes
**`Signs.ipa`** under **Releases** (right side of the repo page). The IPA is unsigned. AltStore
signs it with your free Apple ID when it installs. Download it, then AirDrop or send the file to
the iPhone or Mac.

Signs has its own bundle ID (`com.arahnofob.signs`), so it installs **next to** Mémot and doesn't
touch your French cards.

Each build is numbered: the version is `1.0.<build number>`, shown at the bottom of Settings.

Shortcut from the Mac: hold **Option** and click the AltServer menu-bar icon → **Sideload .ipa…**
→ pick `Signs.ipa` with the iPhone connected.

### One-time setup (with the Mac)

1. On the Mac, install **AltServer** from <https://altstore.io> and start it. It lives in the menu bar.
2. Connect the iPhone to the Mac with a cable and tap **Trust** on the phone.
3. In Finder, select the iPhone and enable **"Show this iPhone when on Wi-Fi"**. This allows wireless refreshes later.
4. Click the AltServer menu-bar icon → **Install AltStore** → choose the iPhone, then sign in with the Apple ID. Follow any extra prompts, such as enabling the Mail plug-in on older versions.
5. On the iPhone:
   - **Settings → General → VPN & Device Management** → trust the Apple ID's developer profile.
   - **Settings → Privacy & Security → Developer Mode** → on. The phone restarts.
6. Download `Signs.ipa` from the latest Release and save it to Files (or AirDrop it to the phone).
7. Open **AltStore → My Apps → +** and pick `Signs.ipa`.

### Keeping it running

- With a free Apple ID, sideloaded apps **expire after 7 days**. AltStore refreshes them automatically in the background when the iPhone and the Mac running AltServer are on the same Wi-Fi. You can also open AltStore → My Apps → **Refresh All**.
- If it does expire, the app won't open until it's refreshed. **No data is lost.**
- A free Apple ID allows 3 sideloaded apps at once, and AltStore counts as one.
- **SideStore** (<https://sidestore.io>) works too. It refreshes on the phone itself, without the Mac.

### Updating

Download the new `Signs.ipa` from Releases and install it the same way through AltStore. The bundle ID
stays the same, so cards and progress are kept. Making a backup first is still a good habit.

## Moving cards from AnkiApp

1. In AnkiApp, open the deck → **Export** → XML. This gives a `.zip` with the cards and any audio. Save it to Files.
2. In Signs, tap **Import** → **Choose file** → pick the zip → **Import**.

AnkiApp's export doesn't include review history, so imported cards start as new. Exact duplicate
cards are skipped. Turn that off on the import screen if you want them.

## Development

```bash
npm install
npm test            # scheduler / import / editor logic tests
npx tsc --noEmit    # typecheck
npx expo lint       # lint
npx expo start --web  # preview in a browser (media aren't persisted on web)
```

- Built with Expo SDK 58 / React Native, Expo Router (`src/app`), and `ts-fsrs` for scheduling.
- Data: `src/lib` holds types, scheduler, queue, importers, storage, and backup. The collection is a single JSON file in the app's Documents folder (`data/collection.json`), with media in `data/media/`. A copy of the previous state is kept as `collection.bak.json`.
- The iOS build is `.github/workflows/build-ios.yml`: `expo prebuild` then an unsigned `xcodebuild`, zipped into an IPA.
