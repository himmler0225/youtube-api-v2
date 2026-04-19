import { Injectable } from '@nestjs/common';
import { User } from '../../../../generated/prisma/client';
import { BasePrismaRepository } from '../../../base/core/prisma/base-prisma.repository';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserRepository extends BasePrismaRepository<User> {
  protected entityName = 'User';

  constructor(private readonly prisma: PrismaService) {
    super(prisma.user);
  }

  findByIdentifier(identifier: string) {
    return this.delegate.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier },
          { username: identifier },
        ],
      },
    });
  }
}
