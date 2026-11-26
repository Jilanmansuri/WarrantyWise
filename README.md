# WarrantyWise — Smart Product Lifecycle, Warranty & Repair Management

A full-stack mobile application built with **React Native (Expo)**, **TypeScript**, **Node.js**, **Express**, and **MongoDB**.

## Project Structure

- `backend/` — Express + TypeScript REST API, Mongoose models, JWT auth, Cloudinary/local document storage, Tesseract OCR invoice/warranty parser, leap-year warranty calculations, AMC & Maintenance tracking, Claim Assistant, Cost Analyzer, Health Score, Lifecycle Timeline, Family Vault authorization, Calendar aggregation, and QR Identity.
- `mobile/` — Expo Router + TypeScript mobile app with React Native Paper UI, Expo Camera (invoice capture + QR scanner) & Image Picker, SecureStore token storage, AsyncStorage offline cache & conflict-aware sync engine, local scheduled notifications, Document Vault, SVG Cost Breakdown charts, and PDF report & resale packet generation.

## Quick Start

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with MONGODB_URI, JWT_SECRET, and Cloudinary credentials (or STORAGE_PROVIDER=local for local dev)
npm install
npm run dev
```

Verify backend:
```bash
npm run typecheck
npm test
npm run build
```

### 2. Mobile Setup

```bash
cd mobile
cp .env.example .env
# Set EXPO_PUBLIC_API_URL (e.g. http://10.0.2.2:5000/api for Android emulator or http://<LAN_IP>:5000/api for physical device)
npm install
npx expo start
```

### 3. Building an Android APK

```bash
cd mobile
npx eas build -p android --profile preview
```
Or locally:
```bash
cd mobile
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

## Database Compatibility & Migration Notes

All enhancements to `Product`, `Document`, and `NotificationPreference` are **additive and backward-compatible**:
- Existing `Product` documents without `lifecycleStatus`, `warrantyTransferable`, `sharedWithFamily`, `version`, or `qrToken` remain valid; `qrToken` is lazily generated on first product detail fetch if missing.
- Optional one-time backfill script command (using `mongosh` against your database) if you want every existing product indexed with a `qrToken` and `lifecycleStatus` immediately:
```js
db.products.updateMany(
  { lifecycleStatus: { $exists: false } },
  { $set: { lifecycleStatus: "Active", warrantyTransferable: false, sharedWithFamily: false, version: 1 } }
);
```

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description | Default |
|---|---|---|
| `PORT` | Express API port | `5000` |
| `NODE_ENV` | `development` \| `production` \| `test` | `development` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://127.0.0.1:27017/warrantywise` |
| `JWT_SECRET` | Secret for signing JWT tokens (required in production) | — |
| `JWT_EXPIRES_IN` | JWT expiration window | `7d` |
| `STORAGE_PROVIDER` | `cloudinary` or `local` | `cloudinary` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | — |
| `CLOUDINARY_API_KEY` | Cloudinary API key | — |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | — |
| `CLOUDINARY_FOLDER` | Cloudinary upload folder | `warrantywise` |
| `OCR_SPACE_API_KEY` | Optional cloud OCR API key (local Tesseract.js is default) | — |

### Mobile (`mobile/.env`)
| Variable | Description | Default |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of WarrantyWise API | `http://10.0.2.2:5000/api` |

## REST API Endpoints

- **Auth**: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/me`, `PUT /api/auth/me`, `GET /api/auth/notifications`, `PUT /api/auth/notifications`
- **Products & Lifecycle**:
  - `POST /api/products`, `GET /api/products`, `GET /api/products/:id`, `PUT /api/products/:id`, `DELETE /api/products/:id`
  - `GET /api/products/:id/lifecycle`, `GET /api/products/:id/cost-analysis`, `GET /api/products/:id/health-score`, `GET /api/products/:id/resale-summary`
  - `POST /api/products/:id/qr/regenerate`, `GET /api/products/qr/:qrToken`
- **Repairs**: `POST /api/repairs`, `GET /api/repairs`, `GET /api/repairs/:productId`, `PUT /api/repairs/:id`, `DELETE /api/repairs/:id`
- **AMC Contracts**: `POST /api/amc`, `GET /api/amc`, `PUT /api/amc/:id`, `POST /api/amc/:id/visit`, `DELETE /api/amc/:id`
- **Smart Maintenance**: `POST /api/maintenance`, `GET /api/maintenance`, `PUT /api/maintenance/:id`, `POST /api/maintenance/:id/complete`, `DELETE /api/maintenance/:id`
- **Warranty Claims**: `POST /api/claims`, `GET /api/claims`, `GET /api/claims/prepare/:productId`, `PUT /api/claims/:id`, `DELETE /api/claims/:id`
- **Family Vault**: `GET /api/family`, `POST /api/family/members`, `PUT /api/family/members/:id`, `DELETE /api/family/members/:id`, `POST /api/family/assign`
- **Calendar**: `GET /api/calendar`
- **Documents**: `POST /api/documents`, `GET /api/documents`, `GET /api/documents/:id/download`, `DELETE /api/documents/:id`
- **Dashboard**: `GET /api/dashboard/stats`, `GET /api/dashboard/upcoming-expiries`
- **OCR**: `POST /api/ocr/parse-invoice`
