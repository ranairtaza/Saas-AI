import prisma from '@/lib/db';
import crypto from 'crypto';

export async function getCreditBalance(organizationId: string) {
  const account = await prisma.creditAccount.findUnique({
    where: { organizationId }
  });

  return account ? {
    available: account.availableBalance,
    reserved: account.reservedBalance
  } : { available: 0, reserved: 0 };
}

export async function grantCredits(
  organizationId: string, 
  amount: number, 
  referenceType: string, 
  referenceId: string, 
  description?: string
) {
  if (amount <= 0) throw new Error("Amount must be positive");
  
  const idempotencyKey = crypto.createHash('sha256').update(`GRANT:${organizationId}:${referenceType}:${referenceId}`).digest('hex');

  return prisma.$transaction(async (tx) => {
    const existing = await tx.creditTransaction.findUnique({ where: { idempotencyKey } });
    if (existing) return;

    let account = await tx.creditAccount.findUnique({ where: { organizationId } });
    if (!account) {
      account = await tx.creditAccount.create({ data: { organizationId } });
    }

    await tx.creditAccount.update({
      where: { organizationId },
      data: { 
        availableBalance: { increment: amount },
        lifetimeGranted: { increment: amount }
      }
    });

    await tx.creditTransaction.create({
      data: {
        organizationId,
        amount,
        type: 'GRANT',
        referenceType,
        referenceId,
        description,
        idempotencyKey
      }
    });
  });
}

export async function reserveCredits(
  organizationId: string,
  amount: number,
  referenceType: string,
  referenceId: string,
  description?: string
) {
  if (amount <= 0) throw new Error("Amount must be positive");
  const idempotencyKey = crypto.createHash('sha256').update(`RESERVE:${organizationId}:${referenceType}:${referenceId}`).digest('hex');

  return prisma.$transaction(async (tx) => {
    const existing = await tx.creditTransaction.findUnique({ where: { idempotencyKey } });
    if (existing) return;

    const { count } = await tx.creditAccount.updateMany({
      where: { 
        organizationId,
        availableBalance: { gte: amount }
      },
      data: { 
        availableBalance: { decrement: amount },
        reservedBalance: { increment: amount }
      }
    });

    if (count === 0) {
      throw new Error("Insufficient credits");
    }

    await tx.creditTransaction.create({
      data: {
        organizationId,
        amount,
        type: 'RESERVE',
        referenceType,
        referenceId,
        description,
        idempotencyKey
      }
    });
  });
}

export async function consumeCredits(
  organizationId: string,
  amount: number,
  referenceType: string,
  referenceId: string,
  description?: string
) {
  if (amount < 0) throw new Error("Amount cannot be negative");
  if (amount === 0) return;

  const idempotencyKey = crypto.createHash('sha256').update(`CONSUME:${organizationId}:${referenceType}:${referenceId}`).digest('hex');

  return prisma.$transaction(async (tx) => {
    const existing = await tx.creditTransaction.findUnique({ where: { idempotencyKey } });
    if (existing) return;

    const { count } = await tx.creditAccount.updateMany({
      where: { 
        organizationId,
        reservedBalance: { gte: amount }
      },
      data: { 
        reservedBalance: { decrement: amount },
        lifetimeConsumed: { increment: amount }
      }
    });

    if (count === 0) {
      throw new Error("Insufficient reserved credits for consumption");
    }

    await tx.creditTransaction.create({
      data: {
        organizationId,
        amount,
        type: 'CONSUME',
        referenceType,
        referenceId,
        description,
        idempotencyKey
      }
    });
  });
}

export async function refundCredits(
  organizationId: string,
  amount: number,
  referenceType: string,
  referenceId: string,
  description?: string
) {
  if (amount < 0) throw new Error("Amount cannot be negative");
  if (amount === 0) return;
  
  const idempotencyKey = crypto.createHash('sha256').update(`REFUND:${organizationId}:${referenceType}:${referenceId}`).digest('hex');

  return prisma.$transaction(async (tx) => {
    const existing = await tx.creditTransaction.findUnique({ where: { idempotencyKey } });
    if (existing) return;

    const { count } = await tx.creditAccount.updateMany({
      where: { 
        organizationId,
        reservedBalance: { gte: amount }
      },
      data: { 
        reservedBalance: { decrement: amount },
        availableBalance: { increment: amount }
      }
    });

    if (count === 0) {
      throw new Error("Insufficient reserved credits for refund");
    }

    await tx.creditTransaction.create({
      data: {
        organizationId,
        amount,
        type: 'REFUND',
        referenceType,
        referenceId,
        description,
        idempotencyKey
      }
    });
  });
}
