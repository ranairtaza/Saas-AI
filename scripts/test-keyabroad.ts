import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany();
  console.log('Organizations:', orgs.length);
  
  if (orgs.length > 0) {
    const creds = await prisma.providerCredential.findMany({
      where: {
        provider: 'keyabroad'
      }
    });
    console.log('KeyAbroad Credentials found:', creds.length);
    for (const c of creds) {
       console.log(`Cred Org: ${c.organizationId}`);
    }
  }

  console.log('KEYABROAD_CRM_BASE_URL:', process.env.KEYABROAD_CRM_BASE_URL ? 'PRESENT' : 'MISSING');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
