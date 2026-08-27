import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';

class CreateCouponDto {
  code!: string;
  chips!: number;
  maxRedemptions!: number;
}

class RedeemDto {
  code!: string;
}

@Controller()
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post('admin/cupons')
  create(@UsuarioAtual() usuarioLogado: string, @Body() body: CreateCouponDto) {
    if (!body?.code || typeof body.chips !== 'number' || typeof body.maxRedemptions !== 'number') {
      throw new BadRequestException('Informe code, chips e maxRedemptions.');
    }
    return this.couponsService.create(usuarioLogado, body.code, body.chips, body.maxRedemptions);
  }

  @Get('admin/cupons')
  list(@UsuarioAtual() actingUserId: string) {
    return this.couponsService.list(actingUserId);
  }

  @Post('admin/cupons/:code/desativar')
  deactivate(@UsuarioAtual() usuarioLogado: string, @Param('code') code: string) {
    return this.couponsService.deactivate(usuarioLogado, code);
  }

  @Post('cupons/resgatar')
  redeem(@UsuarioAtual() usuarioLogado: string, @Body() body: RedeemDto) {
    if (!body?.code) {
      throw new BadRequestException('Informe code.');
    }
    return this.couponsService.redeem(usuarioLogado, body.code);
  }
}
