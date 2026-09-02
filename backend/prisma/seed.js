import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.plan.upsert({
    where: { id: "free" },
    create: {
      id: "free",
      tier: "FREE",
      name: "Free",
      monthlyTokenCap: 100_000,
      maxDevices: 2,
      maxEventsPerDay: 1_000,
      features: { cloudSync: true, prioritySupport: false }
    },
    update: {
      tier: "FREE",
      name: "Free",
      monthlyTokenCap: 100_000,
      maxDevices: 2,
      maxEventsPerDay: 1_000,
      features: { cloudSync: true, prioritySupport: false }
    }
  });
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
