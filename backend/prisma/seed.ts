import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'granix' },
    update: { name: 'Granix' },
    create: {
      slug: 'granix',
      name: 'Granix',
    },
  });

  await prisma.plant.upsert({
    where: {
      tenantId_plantId: {
        tenantId: tenant.id,
        plantId: 'buenos-aires',
      },
    },
    update: {
      name: 'Buenos Aires',
      province: 'buenos-aires',
    },
    create: {
      tenantId: tenant.id,
      plantId: 'buenos-aires',
      name: 'Buenos Aires',
      province: 'buenos-aires',
    },
  });

  await prisma.plant.upsert({
    where: {
      tenantId_plantId: {
        tenantId: tenant.id,
        plantId: 'cordoba',
      },
    },
    update: {
      name: 'Cordoba',
      province: 'cordoba',
    },
    create: {
      tenantId: tenant.id,
      plantId: 'cordoba',
      name: 'Cordoba',
      province: 'cordoba',
    },
  });
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
