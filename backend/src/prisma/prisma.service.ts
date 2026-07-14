import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const MAX_CONNECT_ATTEMPTS = 5;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  /**
   * A transient network blip (Wi-Fi drop, pooler hiccup) at boot shouldn't
   * kill the whole API — retry with a growing delay before giving up.
   */
  async onModuleInit() {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.$connect();
        if (attempt > 1) {
          this.logger.log(`Database connected on attempt ${attempt}`);
        }
        return;
      } catch (err) {
        if (attempt >= MAX_CONNECT_ATTEMPTS) {
          this.logger.error(
            `Database unreachable after ${MAX_CONNECT_ATTEMPTS} attempts`,
          );
          throw err;
        }
        const delaySeconds = attempt * 2;
        this.logger.warn(
          `Database connect failed (attempt ${attempt}/${MAX_CONNECT_ATTEMPTS}), retrying in ${delaySeconds}s…`,
        );
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
