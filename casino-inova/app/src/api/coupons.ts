import { apiRequest, MOCK_USER_ID } from './client';

export interface RedeemCouponResponse {
  code: string;
  chips: number;
  newBalance: number;
}

export function redeemCoupon(code: string): Promise<RedeemCouponResponse> {
  return apiRequest<RedeemCouponResponse>('/cupons/resgatar', {
    method: 'POST',
    body: { userId: MOCK_USER_ID, code },
  });
}
