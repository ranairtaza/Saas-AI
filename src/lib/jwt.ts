import { SignJWT, jwtVerify } from 'jose';

const getSecret = () => {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Production security error: Missing JWT_SECRET or SESSION_SECRET environment variable.');
    }
    return new TextEncoder().encode('fallback_secret_for_dev_only');
  }
  return new TextEncoder().encode(secret);
};

export async function signSessionToken(sessionToken: string): Promise<string> {
  return new SignJWT({ sessionToken })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifySessionJwt(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.sessionToken as string;
  } catch (err) {
    return null;
  }
}
