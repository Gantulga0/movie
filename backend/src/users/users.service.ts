import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generatePublicId } from '../common/ids';

/** User object safe to return to clients (never contains the hash). */
export type SafeUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Strip the password hash before a user is returned in any response. */
  static sanitize(user: User): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safe } = user;
    return safe;
  }

  /** Create a user, retrying on the rare 6-digit publicId collision. */
  async create(data: {
    phone: string;
    email?: string | null;
    passwordHash: string;
    name?: string | null;
  }): Promise<User> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.user.create({
          data: { ...data, publicId: generatePublicId() },
        });
      } catch (err) {
        const isPublicIdClash =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          Array.isArray(err.meta?.target) &&
          (err.meta.target as string[]).includes('publicId');
        if (!isPublicIdClash || attempt >= 5) throw err;
      }
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  /** Login accepts either an email or a phone number as the identifier. */
  findByIdentifier(identifier: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
  }

  async findById(id: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? UsersService.sanitize(user) : null;
  }

  markVerified(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { verified: true },
    });
  }

  updatePassword(id: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  /** Self-service profile edits (display name, avatar). */
  async updateProfile(
    id: string,
    data: { name?: string; avatarUrl?: string },
  ): Promise<SafeUser> {
    const user = await this.prisma.user.update({ where: { id }, data });
    return UsersService.sanitize(user);
  }
}
