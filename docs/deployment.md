# BellekPad — Çalıştırma ve Dağıtım

BellekPad local-first tasarlanır. Netlify yalnızca statik uygulama kabuğunu barındırır; kullanıcı kayıtları varsayılan olarak tarayıcıdaki IndexedDB içinde kalır.

## Yerel geliştirme

```bash
npm install
npm run dev
```

Vite geliştirme sunucusu açılır. Kayıtlar kullanılan origin için tarayıcı IndexedDB'sinde tutulur.

## Yerel production build

```bash
npm install
npm run build
npm run preview
```

`dist/` dizini statik production çıktısıdır.

## Netlify — Git repository üzerinden

Repository Netlify'a bağlandığında `netlify.toml` şu hattı kullanır:

```text
build command: npm run build
publish: dist
```

SPA yönlendirmesi de `netlify.toml` ile tanımlıdır.

## Netlify Drop — hazır artifact

GitHub Actions CI başarılı olduğunda `bellekpad-dist` adlı artifact üretir.

1. İlgili başarılı GitHub Actions çalışmasını aç.
2. `bellekpad-dist` artifact'ını indir.
3. ZIP'i aç.
4. İçindeki statik build klasörünü Netlify Drop'a bırak.

Bu yol yerel bilgisayarda Node.js kurmayı gerektirmez.

## Veri kalıcılığı

Varsayılan veri hattı:

```text
BellekPad UI
  → Domain / Environment Engine
  → Dexie
  → IndexedDB
  → Kullanıcının cihazı
```

Netlify deployment veritabanını barındırmaz ve repository kişisel kayıtları içermez.

BellekPad ayrıca:

- StorageManager Persistent Storage isteği,
- `.bellekpad.json` dışa aktarma,
- yedek içe aktarma,
- Kasa kayıtları için şifreli payload

sağlar.

## Çevrimdışı kullanım

Production build service worker ve web manifest içerir. Uygulama kabuğu ilk başarılı yüklemeden sonra önbelleğe alınır. Veriler zaten IndexedDB'de bulunduğu için temel local-first akış bağlantı olmadan da sürdürülebilir.

## Gelecekte bulut eşitleme

Bulut eşitleme çekirdeğin zorunlu parçası değildir. Gelecekte `SyncAdapter` üzerinden Supabase, WebDAV veya başka bir sağlayıcı bağlanabilir. Yerel repository bunun altında ana çalışma kaynağı olarak kalmalıdır.
