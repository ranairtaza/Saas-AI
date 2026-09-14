import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { verifyPassword, generateSessionToken, hashSessionToken } from '@/lib/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input data.' },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password.' }, // Generic error
        { status: 401 }
      );
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password.' }, // Generic error
        { status: 401 }
      );
    }

    const sessionToken = generateSessionToken();
    const hashedSessionToken = hashSessionToken(sessionToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    await prisma.session.create({
      data: {
        sessionToken: hashedSessionToken,
        userId: user.id,
        expiresAt,
      }
    });

    const { signSessionToken } = await import('@/lib/jwt');
    const jwtToken = await signSessionToken(sessionToken);

    const response = NextResponse.json(
      { message: 'Login successful' },
      { status: 200 }
    );

    response.cookies.set('session', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    const msg = error?.message || '';
    if (
      msg.includes("Can't reach database") ||
      msg.includes('database server') ||
      msg.includes('PrismaClientInitializationError') ||
      error?.code === 'P1001' ||
      error?.code === 'P1000' ||
      error?.code === 'P1017'
    ) {
      return NextResponse.json(
        { error: 'Database service is temporarily unreachable. Please ensure PostgreSQL DATABASE_URL is configured in your deployment settings.' },
        { status: 503 }
      );
    }

    if (error?.code === 'P2021' || msg.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Database schema is not yet initialized. Please run database migrations.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Sign in failed due to a server configuration issue. Please try again.' },
      { status: 500 }
    );
  }
}
