export interface TokenPayload {
  sub: string;
  email: string;
}

export interface TokenIssuer {
  issue(payload: TokenPayload): string;
  verify(token: string): TokenPayload;
}
