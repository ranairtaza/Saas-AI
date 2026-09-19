import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { hashSessionToken } from '@/lib/auth';

let testUserOverride: any = undefined;

export function setTestUserOverride(user: any) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('setTestUserOverride is strictly forbidden in production');
  }
  testUserOverride = user;
}

export async function getCurrentUser() {
  if (testUserOverride !== undefined) {
    return testUserOverride;
  }

  const cookieStore = await cookies();
  let sessionToken = cookieStore.get('session')?.value;

  if (!sessionToken) {
    return null;
  }

  // Attempt to unwrap JWT token, fallback to raw value if it's the old opaque token
  if (sessionToken.split('.').length === 3) {
    const { verifySessionJwt } = await import('@/lib/jwt');
    const unwrappedToken = await verifySessionJwt(sessionToken);
    if (unwrappedToken) {
      sessionToken = unwrappedToken;
    }
  }

  const hashedToken = hashSessionToken(sessionToken);

  const session = await prisma.session.findUnique({
    where: { sessionToken: hashedToken },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          onboarded: true,
          organizationId: true,
          organization: {
            select: {
              id: true,
              name: true,
              apiCredits: true,
            }
          }
        }
      }
    }
  });

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (session.expiresAt.getTime() < Date.now()) {
    // Optionally delete expired session
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
}

export async function invalidateSession() {
  const cookieStore = await cookies();
  let sessionToken = cookieStore.get('session')?.value;

  if (!sessionToken) {
    return;
  }

  // Attempt to unwrap JWT token, fallback to raw value if it's the old opaque token
  if (sessionToken.split('.').length === 3) {
    const { verifySessionJwt } = await import('@/lib/jwt');
    const unwrappedToken = await verifySessionJwt(sessionToken);
    if (unwrappedToken) {
      sessionToken = unwrappedToken;
    }
  }

  const hashedToken = hashSessionToken(sessionToken);
  
  await prisma.session.deleteMany({
    where: { sessionToken: hashedToken }
  }).catch(() => {});

  cookieStore.delete('session');
}
