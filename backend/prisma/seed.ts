import {
  ContentStatus,
  ContentType,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Subscription plans: 1/3/6/12 months. Prices in MNT. */
const PLANS = [
  { name: '1 сар', price: 8000, durationDay: 30 },
  { name: '3 сар', price: 20000, durationDay: 90 },
  { name: '6 сар', price: 50000, durationDay: 180 },
  { name: '12 сар', price: 100000, durationDay: 365 },
];

const GENRES = [
  { name: 'Адал явдалт', slug: 'adventure' },
  { name: 'Тулаант', slug: 'action' },
  { name: 'Инээдмийн', slug: 'comedy' },
  { name: 'Драм', slug: 'drama' },
  { name: 'Аймшгийн', slug: 'horror' },
  { name: 'Триллер', slug: 'thriller' },
  { name: 'Шинжлэх ухааны', slug: 'sci-fi' },
  { name: 'Фантази', slug: 'fantasy' },
  { name: 'Гэмт хэрэгт', slug: 'crime' },
  { name: 'Романтик', slug: 'romance' },
  { name: 'Анимэ', slug: 'anime' },
  { name: 'Баримтат', slug: 'documentary' },
  { name: 'Гэр бүлийн', slug: 'family' },
];

async function main() {
  // ---- Admin -------------------------------------------------------------
  const adminPhone = process.env.ADMIN_PHONE ?? '99000000';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin123!';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: { role: Role.ADMIN, verified: true },
    create: {
      publicId: '100000',
      name: 'Admin',
      phone: adminPhone,
      email: process.env.ADMIN_EMAIL ?? 'admin@movie.local',
      passwordHash,
      role: Role.ADMIN,
      verified: true,
    },
  });

  // ---- Plans ---------------------------------------------------------------
  for (const plan of PLANS) {
    const exists = await prisma.plan.findFirst({ where: { name: plan.name } });
    if (exists) {
      await prisma.plan.update({ where: { id: exists.id }, data: plan });
    } else {
      await prisma.plan.create({ data: plan });
    }
  }

  // ---- Genres --------------------------------------------------------------
  for (const genre of GENRES) {
    await prisma.genre.upsert({
      where: { slug: genre.slug },
      update: { name: genre.name },
      create: genre,
    });
  }

  // ---- Sample content (dev convenience; safe to delete in admin) -----------
  // Poster/backdrop paths point at the frontend's /public folder so local
  // images can be dropped in without any upload step.
  const samples = [
    {
      title: 'John Wick: Chapter 4',
      slug: 'john-wick-chapter-4',
      posterUrl: '/posters/john-wick-chapter-4.jpg',
      backdropUrl: '/backdrops/john-wick-chapter-4.jpg',
      description:
        'Жон Уик Дээд Ширээг ялах арга замыг олж, дэлхий даяарх хамгийн аюултай алуурчидтай тулгарна.',
      type: ContentType.MOVIE,
      status: ContentStatus.PUBLISHED,
      releaseYear: 2023,
      durationSec: 169 * 60,
      language: 'en',
      country: 'USA',
      cast: ['Keanu Reeves', 'Donnie Yen', 'Bill Skarsgård'],
      featured: true,
      genreSlugs: ['action', 'thriller', 'crime'],
    },
    {
      title: 'Godzilla Minus One',
      slug: 'godzilla-minus-one',
      posterUrl: '/posters/godzilla-minus-one.jpg',
      backdropUrl: '/backdrops/godzilla-minus-one.jpg',
      description:
        'Дайны дараах Япон улс аймшигт шинэ мангасын аюулд өртөнө. Амьд үлдсэн нэгэн нисгэгч өөрийн гэм буруутай тэмцэж, эх орноо хамгаалахын төлөө тэмцэнэ.',
      type: ContentType.MOVIE,
      status: ContentStatus.PUBLISHED,
      releaseYear: 2023,
      durationSec: 124 * 60,
      language: 'ja',
      country: 'Japan',
      cast: ['Ryunosuke Kamiki', 'Minami Hamabe'],
      featured: true,
      genreSlugs: ['sci-fi', 'drama', 'action'],
    },
    {
      title: 'The Bear',
      slug: 'the-bear',
      posterUrl: '/posters/the-bear.jpg',
      backdropUrl: '/backdrops/the-bear.jpg',
      description:
        'Залуу тогооч ахынхаа гэнэтийн үхлийн дараа гэр бүлийнхээ жижиг зоогийн газрыг авч үлдэхийн тулд Чикаго руу буцаж ирнэ.',
      type: ContentType.SERIES,
      status: ContentStatus.PUBLISHED,
      releaseYear: 2022,
      language: 'en',
      country: 'USA',
      cast: ['Jeremy Allen White', 'Ayo Edebiri', 'Ebon Moss-Bachrach'],
      featured: false,
      genreSlugs: ['drama', 'comedy'],
    },
  ];

  for (const { genreSlugs, ...sample } of samples) {
    const exists = await prisma.content.findUnique({
      where: { slug: sample.slug },
    });
    if (exists) {
      // Only fill in images that are still empty — never overwrite what an
      // admin uploaded through the panel.
      await prisma.content.update({
        where: { id: exists.id },
        data: {
          posterUrl: exists.posterUrl ?? sample.posterUrl,
          backdropUrl: exists.backdropUrl ?? sample.backdropUrl,
        },
      });
      continue;
    }

    const created = await prisma.content.create({ data: sample });
    for (const slug of genreSlugs) {
      const genre = await prisma.genre.findUnique({ where: { slug } });
      if (genre) {
        await prisma.contentGenre.create({
          data: { contentId: created.id, genreId: genre.id },
        });
      }
    }

    // Series get one season with a couple of placeholder episodes.
    if (sample.type === ContentType.SERIES) {
      const season = await prisma.season.create({
        data: { contentId: created.id, number: 1, title: 'Улирал 1' },
      });
      await prisma.episode.createMany({
        data: [
          { seasonId: season.id, number: 1, title: 'System', durationSec: 28 * 60 },
          { seasonId: season.id, number: 2, title: 'Hands', durationSec: 25 * 60 },
        ],
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seeded admin (${admin.email}, publicId=${admin.publicId}), ${PLANS.length} plans, ${GENRES.length} genres, ${samples.length} contents.`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
