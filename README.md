# githab7# 

Husanboy - diplom, sertifikat va onlayn kurs natijalarini blockchain uslubidagi ledger orqali yaratish, tekshirish va ulashish uchun tayyorlangan ta'lim tizimi MVP'si.

## Asosiy imkoniyatlar

- Talabaga diplom, sertifikat yoki kurs natijasini yaratadi
- Har bir credential uchun `sha256` hash va block yozuvi hosil qiladi
- `recordId` orqali credential haqiqiyligini tekshiradi
- Talaba ma'lumotlarini markazsiz reyestr uslubida saqlaydi
- Onlayn kurs natijalarini `CourseResult` sifatida ro'yxatdan o'tkazadi
- Maxsus share link orqali boshqa universitet yoki ish beruvchiga credential ochadi
- Barcha diplom va sertifikatlarni yagona dashboard'da ko'rsatadi
- `Solidity` smart contract namunasi bilan real blockchain integratsiyasi uchun yo'l ochib beradi

## Loyiha tuzilmasi

- `server.js` - dependency'siz Node.js backend va statik server
- `public/index.html` - asosiy dashboard
- `public/styles.css` - UI dizayn
- `public/app.js` - frontend logika
- `data/db.json` - demo ma'lumotlar bazasi
- `contracts/EduChainRegistry.sol` - smart contract prototipi

## Lokal ishga tushirish

```bash
node server.js
```

Keyin brauzerda `http://localhost:3000` manzilini oching.

## API endpointlar

- `GET /api/dashboard`
- `GET /api/records`
- `GET /api/records/:recordId`
- `POST /api/records`
- `GET /api/students`
- `GET /api/students/:studentId`
- `GET /api/verify/:recordId`
- `POST /api/share`
- `GET /api/public/share/:shareToken`

## GitHub ga yuklash

Repo hali lokal papka holatida. GitHub'ga chiqarish uchun:

```bash
git init
git add .
git commit -m "Build Husanboy MVP"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

## Free deploy variantlari

### Render

1. GitHub repository'ni Render'ga ulang
2. `New Web Service` yarating
3. Build command bo'sh qolishi mumkin
4. Start command: `node server.js`
5. Environment variable: `PORT=10000`

### Railway

1. GitHub repository'ni Railway'ga ulang
2. Start command: `node server.js`
3. Deploy tugmasini bosing

## Real blockchain'ga kengaytirish

1. `contracts/EduChainRegistry.sol` ni Hardhat yoki Foundry orqali testnetga deploy qiling
2. Backend'da RPC URL va private key bilan `issueCredential` ni on-chain chaqiring
3. Metadata uchun IPFS yoki Pinata ulang
4. Frontend'ga wallet connect va transaction holatini qo'shing

## Eslatma

Hozirgi versiya chiroyli interfeysli MVP/prototip. GitHub'ga real push qilish va Render/Railway'ga deploy qilish uchun GitHub akkauntingiz hamda deploy platforma access'i kerak bo'ladi.
