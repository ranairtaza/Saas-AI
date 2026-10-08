import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth';

const prisma = new PrismaClient();

async function main() {
  const orgName = process.argv[2] || 'Pilot Organization';
  const ownerEmail = process.argv[3] || 'owner@pilot.local';
  const ownerPassword = process.argv[4] || 'PilotPassword123!';

  console.log(`Creating Pilot Organization: ${orgName}`);
  
  const org = await prisma.organization.create({
    data: {
      name: orgName,
      timezone: 'UTC',
      locale: 'en-US',
    }
  });

  console.log(`Organization created with ID: ${org.id}`);

  const hashedPassword = await hashPassword(ownerPassword);

  console.log(`Creating Owner User: ${ownerEmail}`);

  const user = await prisma.user.create({
    data: {
      email: ownerEmail,
      name: 'Pilot Owner',
      passwordHash: hashedPassword,
      organizationId: org.id,
      role: 'OWNER',
      onboarded: true,
    }
  });

  console.log(`User created with ID: ${user.id}`);
  console.log('---');
  console.log('Pilot Environment Ready.');
  console.log(`Login Email: ${ownerEmail}`);
  console.log(`Password: ${ownerPassword}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
