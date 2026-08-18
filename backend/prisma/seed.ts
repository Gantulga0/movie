import { ContentStatus, ContentType, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Subscription plans: all 30-day, scoped by genre slugs.
 * Empty genreSlugs = full catalog ("Plus"). Keep each genreSlugs array in
 * canonical (sorted) order — subscription stacking compares scopes with
 * Prisma's order-sensitive list `equals`.
 */
const PLANS = [
  { name: 'Plus', price: 20000, durationDay: 30, genreSlugs: [] as string[] },
  { name: '+18 Кино цуврал', price: 13000, durationDay: 30, genreSlugs: ['adult'] },
  {
    name: '+18 Сонсдог өгүүллэг',
    price: 9900,
    durationDay: 30,
    genreSlugs: ['sonsdog-oguulleg'],
  },
  {
    name: '+18 Уншдаг өгүүллэг',
    price: 7700,
    durationDay: 30,
    genreSlugs: ['nereee-nuutsalsan-zahidal', 'unshdag-oguulleg'],
  },
];

/** Retired duration-only plans — deactivated so they can't be purchased. */
const RETIRED_PLAN_NAMES = ['1 сар', '3 сар', '6 сар', '12 сар'];

const GENRES = [
  { name: 'Адал явдалт', slug: 'adventure', types: [ContentType.MOVIE, ContentType.SERIES] },
  { name: 'Тулаант', slug: 'action', types: [ContentType.MOVIE, ContentType.SERIES] },
  { name: 'Инээдмийн', slug: 'comedy', types: [ContentType.MOVIE, ContentType.SERIES] },
  { name: 'Драм', slug: 'drama', types: [ContentType.MOVIE, ContentType.SERIES] },
  { name: 'Аймшгийн', slug: 'horror', types: [ContentType.MOVIE, ContentType.SERIES] },
  { name: 'Триллер', slug: 'thriller', types: [ContentType.MOVIE, ContentType.SERIES] },
  { name: 'Шинжлэх ухааны', slug: 'sci-fi', types: [ContentType.MOVIE, ContentType.SERIES] },
  { name: 'Фантази', slug: 'fantasy', types: [ContentType.MOVIE, ContentType.SERIES] },
  { name: 'Гэмт хэрэгт', slug: 'crime', types: [ContentType.MOVIE, ContentType.SERIES] },
  { name: 'Романтик', slug: 'romance', types: [ContentType.MOVIE, ContentType.SERIES] },
  { name: 'Анимэ', slug: 'anime', types: [ContentType.MOVIE, ContentType.SERIES] },
  { name: 'Баримтат', slug: 'documentary', types: [ContentType.MOVIE, ContentType.SERIES] },
  { name: 'Гэр бүлийн', slug: 'family', types: [ContentType.MOVIE, ContentType.SERIES] },
  { name: '+18', slug: 'adult', types: [ContentType.MOVIE, ContentType.SERIES] },
  { name: '+18 Уншдаг өгүүллэг', slug: 'unshdag-oguulleg', types: [ContentType.NOVEL] },
  { name: '+18 Сонсдог өгүүллэг', slug: 'sonsdog-oguulleg', types: [ContentType.NOVEL] },
  {
    name: 'Нэрээ нууцалсан захидал',
    slug: 'nereee-nuutsalsan-zahidal',
    types: [ContentType.NOVEL],
  },
];

/** Old novel genres merged into the three above — removed (with links) on seed. */
const REMOVED_GENRE_SLUGS = ['18-mongol', '18-gadaad'];

async function main() {
  // ---- Admin -------------------------------------------------------------
  const adminPhone = process.env.ADMIN_PHONE!;
  const adminPassword = process.env.ADMIN_PASSWORD!;
  const adminEmail = process.env.ADMIN_EMAIL!;

  if (!adminPhone || !adminPassword || !adminEmail) {
    throw new Error(
      'ADMIN_PHONE, ADMIN_PASSWORD, ADMIN_EMAIL must be set in environment variables'
    );
  }
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: { role: Role.ADMIN, verified: true },
    create: {
      publicId: '100000',
      name: 'Admin',
      phone: adminPhone,
      email: adminEmail,
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

  // Old duration-only plans stop being purchasable; existing subscriptions
  // on them keep working until they expire.
  await prisma.plan.updateMany({
    where: { name: { in: RETIRED_PLAN_NAMES }, active: true },
    data: { active: false },
  });

  // ---- Genres --------------------------------------------------------------
  for (const genre of GENRES) {
    await prisma.genre.upsert({
      where: { slug: genre.slug },
      update: { name: genre.name, types: genre.types },
      create: genre,
    });
  }

  // Retired novel genres: drop their content links first, then the genres.
  await prisma.contentGenre.deleteMany({
    where: { genre: { slug: { in: REMOVED_GENRE_SLUGS } } },
  });
  const removedGenres = await prisma.genre.deleteMany({
    where: { slug: { in: REMOVED_GENRE_SLUGS } },
  });
  if (removedGenres.count > 0) {
    // eslint-disable-next-line no-console
    console.log(`Removed ${removedGenres.count} retired genres (${REMOVED_GENRE_SLUGS.join(', ')})`);
  }
  // eslint-disable-next-line no-console
  console.log(
    `Seeded admin (${admin.email}, publicId=${admin.publicId}), ${PLANS.length} plans, ${GENRES.length} genres`
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
