import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * One-off production cleanup: remove test subscription plans.
 *
 * "Test" = any plan priced under 1000₮ (real plans start at 8000₮), e.g. the
 * 1₮ plan used to test the payment flow. Tries a hard delete; if the plan is
 * still referenced by a subscription/payment (foreign key), it falls back to
 * deactivating it so it disappears from the catalog (listPlans filters
 * active: true) without breaking historical records.
 *
 * Run once against the live database:
 *   npx ts-node prisma/cleanup-test-plans.ts
 */
const TEST_PRICE_CEILING = 1000; // ₮ — anything cheaper is a test plan

async function main() {
  const testPlans = await prisma.plan.findMany({
    where: { price: { lt: TEST_PRICE_CEILING } },
  });

  if (testPlans.length === 0) {
    // eslint-disable-next-line no-console
    console.log('Цэвэрлэх туршилтын plan олдсонгүй.');
    return;
  }

  for (const plan of testPlans) {
    try {
      await prisma.plan.delete({ where: { id: plan.id } });
      // eslint-disable-next-line no-console
      console.log(`Устгасан: "${plan.name}" (${plan.price}₮)`);
    } catch {
      // Referenced by a subscription/payment — deactivate instead of deleting.
      await prisma.plan.update({
        where: { id: plan.id },
        data: { active: false },
      });
      // eslint-disable-next-line no-console
      console.log(
        `Идэвхгүй болгосон (түүхтэй тул устгасангүй): "${plan.name}" (${plan.price}₮)`,
      );
    }
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
