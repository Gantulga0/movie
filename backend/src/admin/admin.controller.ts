import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymentStatus, Role } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';
import { AdminService } from './admin.service';
import { BillingService } from '../billing/billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class GrantSubscriptionDto {
  @IsString()
  planId!: string;
}

class SetRoleDto {
  @IsEnum(Role)
  role!: Role;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly billing: BillingService,
  ) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('users')
  users(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.listUsers({
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('users/:id')
  user(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Patch('users/:id/role')
  setRole(@Param('id') id: string, @Body() dto: SetRoleDto) {
    return this.admin.setUserRole(id, dto.role);
  }

  /** Hand out subscription time without a payment (support cases, promos). */
  @Post('users/:id/grant')
  grant(@Param('id') id: string, @Body() dto: GrantSubscriptionDto) {
    return this.billing.grantSubscription(id, dto.planId);
  }

  @Delete('subscriptions/:id')
  cancelSubscription(@Param('id') id: string) {
    return this.admin.cancelSubscription(id);
  }

  @Get('payments')
  payments(
    @Query('status') status?: PaymentStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.listPayments({
      status,
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
