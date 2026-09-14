import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { hashPassword, generateSessionToken, hashSessionToken } from '@/lib/auth';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  organizationName: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input data.' },
        { status: 400 }
      );
    }

    const { email, password, name, organizationName } = result.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Return a generic error to prevent email enumeration
      return NextResponse.json(
        { error: 'Registration failed. Please check your details or try logging in.' },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const sessionToken = generateSessionToken();
    const hashedSessionToken = hashSessionToken(sessionToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    const txResult = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: organizationName },
      });

      const user = await tx.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          name,
          organizationId: org.id,
          role: 'OWNER',
        },
      });

      const session = await tx.session.create({
        data: {
          sessionToken: hashedSessionToken,
          userId: user.id,
          expiresAt,
        }
      });

      return { user, org };
    });

    const { signSessionToken } = await import('@/lib/jwt');
    const jwtToken = await signSessionToken(sessionToken);

    const response = NextResponse.json(
      { message: 'Registration successful' },
      { status: 201 }
    );

    response.cookies.set('session', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
