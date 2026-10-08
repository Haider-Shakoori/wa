export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type AuthTokenPayload = {
  sub: string;
  email: string;
  org: string;
  membership: string;
  sid?: string;
  ver?: number;
};
