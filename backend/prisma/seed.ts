import { ContentStatus, ContentType, PrismaClient, Role } from '@prisma/client';
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
  { name: 'Уншдаг өгүүллэг', slug: 'unshdag-oguulleg', types: [ContentType.NOVEL] },
  { name: 'Сонсдог өгүүллэг', slug: 'sonsdog-oguulleg', types: [ContentType.NOVEL] },
  { name: '+18 Монгол', slug: '18-mongol', types: [ContentType.NOVEL] },
  { name: '+18 гадаад', slug: '18-gadaad', types: [ContentType.NOVEL] },
  {
    name: 'Нэрээ нууцалсан захидал',
    slug: 'nereee-nuutsalsan-zahidal',
    types: [ContentType.NOVEL],
  },
];

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

  // ---- Genres --------------------------------------------------------------
  for (const genre of GENRES) {
    await prisma.genre.upsert({
      where: { slug: genre.slug },
      update: { name: genre.name, types: genre.types },
      create: genre,
    });
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
