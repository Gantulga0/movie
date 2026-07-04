# Movie App — Frontend (Next.js)

Premium MNFlix-style streaming UI: landing page, auth (login/register), and a
protected movie home page.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- JWT auth via a client `AuthProvider` (token in `localStorage`)

## Setup

```bash
cp .env.example .env.local   # points at the backend API
npm install
npm run dev
```

App runs on `http://localhost:3000`. Make sure the backend is running on
`http://localhost:4000`.

## Routes

| Route       | Access        | Description                          |
| ----------- | ------------- | ------------------------------------ |
| `/`         | public        | Landing page with hero carousel      |
| `/login`    | public        | Login (email or phone)               |
| `/register` | public        | Register (name, email, phone, pass)  |
| `/home`     | authenticated | Movie browse page                    |

Logged-in users visiting `/`, `/login`, or `/register` are redirected to
`/home`. Unauthenticated users visiting `/home` are redirected to `/login`.

## Environment

| Variable              | Description                          |
| --------------------- | ------------------------------------ |
| `NEXT_PUBLIC_API_URL` | Backend API base URL (with `/api`)   |
