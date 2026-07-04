# Movie App — Backend (NestJS)

REST API for the movie streaming platform MVP: JWT auth, movie CRUD, and
Cloudflare R2 uploads.

## Stack

- NestJS 10 (REST)
- Prisma + PostgreSQL
- JWT auth (Passport), bcrypt password hashing
- Cloudflare R2 (S3 compatible) for poster/banner uploads

## Setup

```bash
cp .env.example .env        # fill in the values
npm install
npm run prisma:generate
npm run prisma:migrate      # creates the tables (needs a running Postgres)
npm run prisma:seed         # optional: admin user + sample movies
npm run start:dev
```

API runs on `http://localhost:4000/api`.

Seeded admin: `admin@movie.local` / `Admin123!`

## Endpoints

| Method | Path                     | Access | Description                       |
| ------ | ------------------------ | ------ | --------------------------------- |
| POST   | `/api/auth/register`     | public | name, email, phone, password      |
| POST   | `/api/auth/login`        | public | identifier (email/phone), password|
| POST   | `/api/auth/logout`       | auth   | client discards the token         |
| GET    | `/api/auth/me`           | auth   | current user                      |
| GET    | `/api/movies`            | public | published movies                  |
| GET    | `/api/movies/:id`        | public | one movie                         |
| GET    | `/api/movies/admin/all`  | admin  | all movies incl. unpublished      |
| POST   | `/api/movies`            | admin  | create                            |
| PATCH  | `/api/movies/:id`        | admin  | update                            |
| DELETE | `/api/movies/:id`        | admin  | delete                            |
| POST   | `/api/storage/poster`    | admin  | multipart `file` → { key, url }   |
| POST   | `/api/storage/banner`    | admin  | multipart `file` → { key, url }   |

All responses omit the user password hash.
