import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const a = await prisma.classOffering.findFirst({
    where: { title: { contains: "Cohort A" } },
  });
  const b = await prisma.classOffering.findFirst({
    where: { title: { contains: "Cohort B" } },
  });
  if (a) {
    await prisma.classOffering.update({
      where: { id: a.id },
      data: { themeColor: "#6b21c8" },
    });
  }
  if (b) {
    await prisma.classOffering.update({
      where: { id: b.id },
      data: { themeColor: "#0f766e" },
    });
  }
  console.log({ a: a?.title, b: b?.title });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
