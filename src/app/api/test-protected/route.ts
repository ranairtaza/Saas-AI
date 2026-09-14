import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ message: 'Success', user }, { status: 200 });
}
