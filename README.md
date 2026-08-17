# Preview
<img width="672" height="130" alt="Ekran Alıntısı1" src="https://github.com/user-attachments/assets/a0cd7645-c3f7-49d0-a92b-0416db010d45" />
<img width="599" height="347" alt="Ekran Alıntısı" src="https://github.com/user-attachments/assets/d2e0e676-ecaf-4380-b852-eeb8a708488c" />



# Scoreboard

> **Türkçe** · [English](#english)

---

## Türkçe

Canlı maç skorlarını gösteren, **animasyonlu skorboard** (overlay) uygulaması — Windows masaüstü (Electron).

Oyun oynarken ekranın üstünde saydam, tıklama-geçiren bir overlay olarak durur; seçtiğiniz maçlar arasında otomatik döner. Ayrıca OBS yayınına browser source olarak da eklenebilir.

### Özellikler

- **Canlı skor + dakika**: Belirli aralıklarla (varsayılan 15 sn) anlık veri çeker; skor değişince **gol animasyonu** oynatır, dakika saniye saniye işler.
- **Modern animasyonlu tasarım**: Cam efektli, ışıklı panel; ortada büyük skor + canlı dakika, solda/sağda takım amblemi ve isimler.
- **Lige göre orta eleman değişir**: Skorun altındaki lig amblemi ve tüm panelin renk vurgusu, o maçın ligine göre otomatik değişir (ör. İngiltere, İspanya, Almanya, İtalya ve Türkiye liglerinin renkleri tanınır; tanınmayan lige benzersiz bir renk atanır).
- **Birkaç maç, otomatik dönüş**: Seçtiğiniz maçlar arasında ayarlanabilir süreyle geçiş yapar.
- **Tıklama-geçiren overlay**: Overlay her zaman mouse girişini engellemez; oyunu etkilemez. `Ctrl+Shift+S` ile göster/gizle.
- **Favori ligler**: Lig satırındaki yıldıza tıklayarak lige favori ekleyin/kaldırın; favoriler listenin en üstünde toplanır ve "Sadece favoriler" filtresiyle görüntülenebilir. Favoriler kalıcı olarak saklanır.
- **Kart rozetleri**: Canlı maçlarda sarı/kırmızı kartlar, takım logosunun üzerinde anlık olarak küçük rozetler hâlinde istiflenir. Sadece kartlar eklenir; goller listeye girip kalabalık yapmaz (skor değişimi + gol animasyonu golleri zaten gösterir).
- **Maç istatistikleri**: Her 20 dakikada bir ve **devre arasına girildiğinde** ekranın ortasında istatistik paneli açılır — topla oynama, toplam/isabetli pas, şut, korner, faul ve kartlar.
- **Dil seçimi**: Kontrol panelinden arayüz **Türkçe** veya **English** olarak değiştirilebilir (kontrol paneli ve skorboard birlikte değişir).
- **Konum seçimi**: Skorboard 6 konuma yerleştirilebilir — alt, üst, sol üst, sağ üst, sol orta, sağ orta.
- **Sürüm rozeti**: İsteğe bağlı olarak ekranın sol altına veya sol üstüne `Scoreboard 0.02 Beta` etiketi gösterilebilir.
- **OBS uyumlu**: `http://127.0.0.1:3710/overlay` adresi OBS Browser Source'a eklenebilir.

### Çalıştırma

```bat
start.bat
```

veya:

```bash
npm install
npm start
```

Not: Elektron indirmesi birkaç dakika sürebilir (tek seferlik).

### Kullanım

1. Uygulama açılınca **kontrol penceresi** gelir.
2. Soldan bir **lig** seçin (canlı maç sayısı yeşil "CANLI" rozetinde görünür). İstediğiniz ligleri yıldıza tıklayarak **favoriye** ekleyebilirsiniz; favoriler en üstte sıralanır.
3. Sağdaki maç listesinden izlemek istediklerinizi **işaretleyin**.
4. Alttaki ayarlardan dönüş süresi, ölçek, opaklık, konum (alt / üst / köşeler / orta hizalama), dil (Türkçe/English), sürüm rozeti (sol alt / sol üst) değiştirilebilir.
5. Overlay, ana ekranın altında saydam pencere olarak görünür. Mouse tıklamaları oyuna geçer.

#### Kısayollar

| Tuş | İşlev |
| --- | --- |
| `Ctrl+Shift+S` | Panoyu göster / gizle |

### OBS Kurulumu

1. Uygulamayı çalıştırın (kontrol penceresi açık kalsın).
2. OBS → Kaynaklar → **+** → **Tarayıcı (Browser)**.
3. URL kutusuna `http://127.0.0.1:3710/overlay` yazın (kontrol panelindeki kutudan kopyalayabilirsiniz).
4. Genişlik/yükseklik örneğin 1920x1080. Kaynağı ekranın altına yerleştirin.

Tarayıcı kaynağı şeffaf çalışır; skorboard dışı kısım görünmez.

### Veri Kaynağı

Uygulama, canlı skorlar için halka açık bir uç noktayı (`mackolik.com/perform/.../livescores/json`) okur. Resmî bir API değildir — sık istek atmamaya özen gösterin (varsayılan 15 saniye). İnternet yoksa veya istek engellenirse panel "Hata" gösterir; otomatik tekrar dener.

### Paketleme (isteğe bağlı)

Tek exe üretmek için:

```bash
npm install --save-dev electron-builder
npm run dist
```

`dist/` klasöründe taşınabilir (portable) bir `.exe` oluşur.

### Dizin yapısı

```
scoreboard/
├── start.bat
├── package.json
└── src/
    ├── main.js        # Electron ana işlem: pencereler, HTTP sunucu, IPC, veri yoklaması
    ├── mackolik.js    # Skor verisi çekme + ayrıştırma + dakika hesabı
    ├── leagues.js     # Lig renk/amblem eşleştirme
    ├── i18n.js        # Türkçe / English arayüz çevirileri
    ├── preload.js     # Kontrol paneli IPC köprüsü
    ├── overlay/       # Skorboard (index.html, style.css, app.js)
    └── control/       # Kontrol paneli (index.html, style.css, app.js)
```

### Not

- Ayarlar `%APPDATA%\skor-panosu\skor-panosu.json` dosyasında saklanır.
- Uygulama şu an **futbol** maçlarını gösterir (basketbol/tenis gibi diğer sporlar da istenirse `src/mackolik.js` içindeki `sports[]` parametresi değiştirilerek eklenebilir).

---

# English

A Windows desktop app (Electron) that shows **live match scores** on an animated **scoreboard overlay**.

It sits on top of your screen as a transparent, click-through overlay while you play and cycles through the matches you pick. It can also be added to an OBS stream as a browser source.

### Features

- **Live score + minute**: Fetches fresh data at a set interval (default 15 s); plays a **goal animation** when the score changes and ticks the minute second-by-second.
- **Modern animated design**: A glassy, glowing panel with a big center score + live minute and team crests/names on the left and right.
- **League-based accent**: The league emblem under the score and the whole panel's accent color change automatically with the match's league (e.g. English, Spanish, German, Italian and Turkish league colors are recognized; unknown leagues get a unique color).
- **Multi-match auto rotation**: Switches between your selected matches on an adjustable timer.
- **Click-through overlay**: The overlay never blocks your mouse, so it won't interfere with gameplay. Toggle with `Ctrl+Shift+S`.
- **Favorite leagues**: Click the star on a league row to add/remove favorites; favorites sort to the top and can be filtered with "Only favorites". Favorites persist across restarts.
- **Card badges**: During live matches, yellow/red cards pop in instantly as small badges stacked on the team crest. Only cards are added; goals do not join the list and crowd it (the score change + goal animation already shows them).
- **Match statistics**: Every 20 minutes and **when the half-time break starts**, a stats panel opens in the center of the screen — possession, total/accurate passes, shots, corners, fouls and cards.
- **Language selection**: The interface can be switched between **Türkçe** and **English** from the control panel (control panel and scoreboard switch together).
- **Position selection**: The scoreboard can be placed in 6 positions — bottom, top, top-left, top-right, middle-left, middle-right.
- **Version badge**: Optionally show a `Scoreboard 0.02 Beta` label at the bottom-left or top-left of the screen.
- **OBS ready**: The address `http://127.0.0.1:3710/overlay` can be added as an OBS Browser Source.

### Running

```bat
start.bat
```

or:

```bash
npm install
npm start
```

Note: The Electron download may take a few minutes (one-time only).

### Usage

1. The **control window** opens when the app starts.
2. Pick a **league** on the left (the number of live matches shows in the green "CANLI"/"LIVE" badge). Star any league to make it a **favorite**; favorites sort to the top.
3. **Check** the matches you want to watch in the match list on the right.
4. From the settings at the bottom you can change rotate interval, scale, opacity, position (bottom / top / corners / middle alignment), language (Türkçe/English) and the version badge (bottom-left / top-left).
5. The overlay appears as a transparent window on the screen. Mouse clicks pass through to your game.

#### Shortcuts

| Key | Function |
| --- | --- |
| `Ctrl+Shift+S` | Show / hide the board |

### OBS Setup

1. Run the app (keep the control window open).
2. OBS → Sources → **+** → **Browser**.
3. Type `http://127.0.0.1:3710/overlay` in the URL box (you can copy it from the control panel).
4. Width/height e.g. 1920x1080. Place the source at the bottom of the screen.

The browser source renders transparently; everything outside the scoreboard is invisible.

### Data Source

The app reads a public endpoint used for live scores (`mackolik.com/perform/.../livescores/json`). It is not an official API — please avoid making requests too often (default 15 s). If there is no internet or the request is blocked, the panel shows "Error" and retries automatically.

### Packaging (optional)

To produce a single exe:

```bash
npm install --save-dev electron-builder
npm run dist
```

A portable `.exe` is created in the `dist/` folder.

### Directory structure

```
scoreboard/
├── start.bat
├── package.json
└── src/
    ├── main.js        # Electron main process: windows, HTTP server, IPC, data polling
    ├── mackolik.js    # Score data fetching + parsing + minute calculation
    ├── leagues.js     # League color/emblem matching
    ├── i18n.js        # Türkçe / English UI translations
    ├── preload.js     # Control panel IPC bridge
    ├── overlay/       # Scoreboard (index.html, style.css, app.js)
    └── control/       # Control panel (index.html, style.css, app.js)
```

### Notes

- Settings are stored in `%APPDATA%\skor-panosu\skor-panosu.json`.
- The app currently shows **football** matches (other sports like basketball/tennis can be added by changing the `sports[]` parameter in `src/mackolik.js` if desired).
