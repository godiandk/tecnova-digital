import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CouponsService } from './coupons.service';

class CreateCouponDto {
  actingUserId!: string;
  code!: string;
  chips!: number;
  maxRedemptions!: number;
}

class RedeemDto {
  userId!: string;
  code!: string;
}

@Controller()
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post('admin/cupons')
  create(@Body() body: CreateCouponDto) {
    if (!body?.actingUserId || !body?.code || typeof body.chips !== 'number' || typeof body.maxRedemptions !== 'number') {
      throw new BadRequestException('Informe actingUserId, code, chips e maxRedemptions.');
    }
    return this.couponsService.create(body.actingUserId, body.code, body.chips, body.maxRedemptions);
  }

  @Get('admin/cupons')
  list(@Query('actingUserId') actingUserId: string) {
    if (!actingUserId) {
      throw new BadRequestException('Informe actingUserId.');
    }
    return this.couponsService.list(actingUserId);
  }

  @Post('admin/cupons/:code/desativar')
  deactivate(@Param('code') code: string, @Body() body: { actingUserId: string }) {
    if (!body?.actingUserId) {
      throw new BadRequestException('Informe actingUserId.');
    }
    return this.couponsService.deactivate(body.actingUserId, code);
  }

  @Post('cupons/resgatar')
  redeem(@Body() body: RedeemDto) {
    if (!body?.userId || !body?.code) {
      throw new BadRequestException('Informe userId e code.');
    }
    return this.couponsService.redeem(body.userId, body.code);
  }
}
