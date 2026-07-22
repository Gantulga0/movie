import { PrismaClient } from '@prisma/client';

/**
 * One-off helper: adds a cheap 500₮ / 1-day plan for a real wire.mn payment
 * test. Idempotent (upsert by name). Remove after testing with:
 *   npx ts-node prisma/test-plan.ts --off   (deactivates, keeps history)
 */
const prisma = new PrismaClient();

async function main() {
  const off = process.argv.includes('--off');
  const name = 'Тест 500₮';
  const existing = await prisma.plan.findFirst({ where: { name } });

  if (off) {
    if (existing) {
      await prisma.plan.update({
        where: { id: existing.id },
        data: { active: false },
      });
      console.log(`Deactivated test plan: ${existing.id}`);
    } else {
      console.log('No test plan found.');
    }
    return;
  }

  const data = { name, price: 500, durationDay: 1, maxDevices: 1, active: true };
  const plan = existing
    ? await prisma.plan.update({ where: { id: existing.id }, data })
    : await prisma.plan.create({ data });
  console.log(`Test plan ready: ${plan.id} · ${plan.name} · ${plan.price}₮`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
