import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);
  
  const org = await prisma.organization.create({
    data: { name: 'Subagent Corp' }
  });

  await prisma.user.create({
    data: {
      email: 'subagent@example.com',
      passwordHash,
      name: 'Sub Agent',
      organizationId: org.id
    }
  });

  const lead1 = await prisma.lead.create({
    data: {
      organizationId: org.id,
      companyName: 'Test Corp',
      contactEmail: 'test@example.com',
      status: 'DISCOVERED',
      score: 50,
      scoreType: 'RULE_BASED'
    }
  });

  console.log('Seeded DB. Lead ID:', lead1.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
