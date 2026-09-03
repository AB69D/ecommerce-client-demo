# Licensing System — সোর্স কোড প্রোটেকশন

এই ডকুমেন্ট শুধু **সেলার (আপনি)**-এর জন্য। এইটা ব্যাখ্যা করে কিভাবে প্রতিটা client-কে বিক্রি করা কোডবেস একটা নির্দিষ্ট domain-এ লক করে দিতে হয়, যাতে raw source code হাতে পেলেও অন্য কোনো domain-এ সেটা চালানো না যায় (যদি না কোড থেকে ইচ্ছাকৃতভাবে check-টা মুছে ফেলা হয়)।

## কিভাবে কাজ করে (কোনো সার্ভার ছাড়াই)

- আপনার কাছে একটা **private key** থাকে (কখনো কোনো client-কে দেওয়া হয় না)।
- কোডবেসের ভেতর একটা **public key** committed থাকে ([backend/src/config/license-public-key.pem](../backend/src/config/license-public-key.pem)) — এইটা শুধু signature verify করতে পারে, নতুন license বানাতে পারে না, তাই ship করা নিরাপদ।
- প্রতি client-এর জন্য আপনি লোকালি একটা script চালিয়ে একটা signed token (`LICENSE_KEY`) বানান, যেটার ভেতর client-এর domain + মেয়াদ (expiry) encode করা থাকে।
- Client সেই token তাদের `.env`-এ বসায়। তাদের backend সেটাকে বুট হওয়ার সময় ও প্রতি request-এ verify করে।
- **Verification পুরোপুরি client-এর নিজের সার্ভারে locally হয় — আপনার কোনো hosting/server লাগে না।**

## এক-বারের setup (ইতিমধ্যে করা হয়েছে)

RSA keypair বানানো হয়েছে এবং:
- Public key → `backend/src/config/license-public-key.pem`-এ committed (git-এ আছে)।
- Private key → আপনাকে chat-এ ফাইল হিসেবে পাঠানো হয়েছে (`license-private-key.pem`)।

**⚠️ এখনই করুন:** ঐ private key ফাইলটা —
- একটা password manager (Bitwarden/1Password) অথবা encrypted local backup-এ সেভ করুন।
- চাইলে একটা **আলাদা প্রাইভেট git repo**-তে রাখতে পারেন (যেটা কখনো কোনো client-কে access দেবেন না) — সাথে কোন client-কে কবে/কোন domain-এ/কতদিনের জন্য license দিয়েছেন তার একটা log (`licenses.csv` বা `.json`) রাখলে ভবিষ্যতে ট্র্যাক রাখা সহজ হবে।
- **কখনো এই মূল প্রোডাক্ট রিপোতে commit করবেন না** — root [.gitignore](../.gitignore)-এ `**/*.pem` blanket-ignore করা আছে, শুধু public key-টার জন্য exception দেওয়া আছে। ভুলেও private key-এর filename পরিবর্তন করে সেই exception প্যাটার্নে ফেলবেন না।

যদি এই key কখনো হারিয়ে যায়, নতুন keypair বানাতে হবে:
```bash
openssl genrsa -out license-private-key.pem 2048
openssl rsa -in license-private-key.pem -pubout -out license-public-key.pem
```
নতুন public key দিয়ে repo-র `backend/src/config/license-public-key.pem` replace করে সব client-কে **নতুন `LICENSE_KEY` আবার ইস্যু করে পাঠাতে হবে** (পুরনো key-এর সাইন করা সব token তখন আর valid থাকবে না)।

## নতুন client-কে license দেওয়া

```bash
LICENSE_PRIVATE_KEY_PATH=/path/to/license-private-key.pem \
  node src/scripts/generate-license.js --client "Client Name" --domain shop.client.com --days 365
```
(কমান্ডটা `backend/` ফোল্ডারের ভেতর থেকে চালাতে হবে, dependency ইনস্টল করা থাকতে হবে — `npm install`)

Output-এ একটা লাইন পাবেন:
```
LICENSE_KEY=eyJhbGciOi...
```
এইটা client-কে দিন — তারা তাদের `backend/.env`-এ বসাবে (দেখুন [backend/.env.example](../backend/.env.example))। `--domain`-এ client আসলে যে domain-এ deploy করবে সেটাই দিতে হবে (যেমন `shop.client.com`, `www` বা `https://` ছাড়া — script নিজে থেকেই normalize করে নেয়)।

`--days`-এ license-এর মেয়াদ দিন (যেমন বার্ষিক subscription হলে `365`, one-time হলে অনেক বড় সংখ্যা যেমন `36500`)।

## Client-এর deployment-এ যা লাগবে

Client-এর `backend/.env`-এ (production-এ) এই দুইটা লাগবে:
```
NODE_ENV=production
LICENSE_KEY=<আপনার দেওয়া token>
```
`LICENSE_KEY` ছাড়া `NODE_ENV=production`-এ app **বুট-ই হবে না** ([backend/src/config/env.js](../backend/src/config/env.js))। ভুল domain-এ deploy করলে app বুট হবে কিন্তু সব API request `503 Service unavailable: domain not licensed` রিটার্ন করবে ([backend/src/middlewares/license.middleware.js](../backend/src/middlewares/license.middleware.js))।

**Development mode-এ (`NODE_ENV=development`) কোনো license লাগে না** — নিজেদের লোকাল development-এ কোনো সমস্যা হবে না।

## মেয়াদ শেষ হলে

Token-এর ভেতরের `exp` পার হয়ে গেলে server প্রতি ৬ ঘণ্টায় re-check করে (restart ছাড়াই) request block করা শুরু করবে। Renew করতে হলে শুধু client-এর জন্য আবার `generate-license.js` চালিয়ে নতুন `LICENSE_KEY` দিন, client শুধু `.env` আপডেট করে backend restart করবে।

## সীমাবদ্ধতা (সৎভাবে বলা দরকার)

- যেহেতু পুরো source code client-কে দেওয়া হয়, একজন determined developer কোডে গিয়ে `licenseGuard` middleware-এর লাইনটা মুছে দিতে পারবে — এইটা কোনো technical measure দিয়েই ১০০% আটকানো যায় না।
- এইটা casual/accidental copying (যেমন শুধু ফাইল কপি করে অন্য domain-এ বসিয়ে দেওয়া) কার্যকরভাবে বন্ধ করে, আর deliberate bypass করতে হলে ইচ্ছাকৃতভাবে কোড এডিট করতে হয় — যেটা প্রমাণ করা সহজ এবং legal action-এর ground তৈরি করে।
- এইজন্য একটা **License Agreement / EULA** (single-site license, no-resale clause) প্রতি client-কে সাইন করানো সমান জরুরি — টেকনিক্যাল protection-এর সাথে সাথে legal protection ছাড়া কোনোটাই সম্পূর্ণ না। চাইলে এইটার একটা template আলাদাভাবে বানিয়ে দিতে পারি।

## Troubleshooting

| সমস্যা | কারণ |
|---|---|
| Production-এ boot হচ্ছে না, log-এ `LICENSE_KEY is required` | `.env`-এ `LICENSE_KEY` সেট করা হয়নি |
| সব API `503 invalid license` দিচ্ছে | Token expire হয়ে গেছে, অথবা ভুল/করাপ্ট `LICENSE_KEY` বসানো হয়েছে |
| সব API `503 domain not licensed` দিচ্ছে | যে domain-এ deploy করা হয়েছে সেটা token ইস্যু করার সময় দেওয়া `--domain`-এর সাথে মিলছে না |
| `generate-license.js` চালাতে গেলে "Private key not found" | `LICENSE_PRIVATE_KEY_PATH` ভুল অথবা key ফাইল ঐ path-এ নেই |
