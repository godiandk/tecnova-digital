import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { StoreService } from './store.service';

class FulfillPurchaseDto {
  userId!: string;
  packageId!: string;
}

@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get('pacotes')
  listPackages() {
    return this.storeService.listPackages();
  }

  @Post('comprar')
  fulfillPurchase(@Body() body: FulfillPurchaseDto) {
    if (!body?.userId || !body?.packageId) {
      throw new BadRequestException('Informe userId e packageId.');
    }
    return this.storeService.fulfillPurchase(body.userId, body.packageId);
  }
}
