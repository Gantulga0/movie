import { Prisma, PrismaClient, SubscriptionStatus } from '@prisma/client';

/** Any Prisma client shape the helpers accept (plain client or a tx). */
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * The genre scopes of a user's active subscriptions — one `string[]` per
 * subscription, taken from `plan.genreSlugs`. An EMPTY array means the plan
 * covers the full catalog ("Plus" and grandfathered duration-only plans).
 */
export async function activePlanScopes(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<string[][]> {
  const subs = await db.subscription.findMany({
    where: {
      userId,
      status: SubscriptionStatus.ACTIVE,
      endsAt: { gt: now },
    },
    select: { plan: { select: { genreSlugs: true } } },
  });
  return subs.map((s) => s.plan.genreSlugs);
}

/**
 * Whether any of the caller's plan scopes covers a title with the given
 * genre slugs: a full-catalog scope (empty) always covers; a category scope
 * covers when it shares at least one slug with the title.
 */
export function scopesCover(
  scopes: string[][],
  contentGenreSlugs: string[],
): boolean {
  return scopes.some(
    (scope) =>
      scope.length === 0 ||
      scope.some((slug) => contentGenreSlugs.includes(slug)),
  );
}
