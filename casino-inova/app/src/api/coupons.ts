import { apiRequest } from './client';

export interface RedeemCouponResponse {
  code: string;
  chips: number;
  newBalance: number;
}

export function redeemCoupon(code: string): Promise<RedeemCouponResponse> {
  return apiRequest<RedeemCouponResponse>('/cupons/resgatar', {
    method: 'POST',
    body: { code },
  });
}
