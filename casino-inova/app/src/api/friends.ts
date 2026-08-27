import { apiRequest } from './client';

export interface Friend {
  userId: string;
  name: string;
  level: number;
}

export interface FriendRequestDto {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pendente' | 'aceita';
  createdAt: string;
  otherUserName: string;
}

export interface PendingRequests {
  recebidos: FriendRequestDto[];
  enviados: FriendRequestDto[];
}

export function fetchFriends(): Promise<Friend[]> {
  return apiRequest<Friend[]>(`/amigos`);
}

export function fetchPendingFriendRequests(): Promise<PendingRequests> {
  return apiRequest<PendingRequests>(`/amigos/pendentes`);
}

export function sendFriendRequest(targetUserId: string): Promise<FriendRequestDto> {
  return apiRequest<FriendRequestDto>('/amigos/pedir', { method: 'POST', body: { targetUserId } });
}

export function respondFriendRequest(requestId: string, accept: boolean): Promise<unknown> {
  return apiRequest(`/amigos/${requestId}/responder`, { method: 'POST', body: { accept } });
}
