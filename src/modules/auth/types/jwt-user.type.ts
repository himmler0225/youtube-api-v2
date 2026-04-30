export interface jwtUser {
  userId: string;
  sessionId: string;
  jti: string;
  exp: number;
}
