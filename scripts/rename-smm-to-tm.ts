import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.position.findMany({
    where: {
      type: "STAFF",
      OR: [
        { title: { contains: "Social Media", mode: "insensitive" } },
        { title: { contains: "Technology Manager", mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true },
  });
  console.log("Staff openings:", rows);

  const upd = await prisma.position.updateMany({
    where: {
      type: "STAFF",
      title: { equals: "Social Media Manager", mode: "insensitive" },
    },
    data: { title: "Technology Manager" },
  });
  console.log("Renamed Social Media Manager → Technology Manager:", upd.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
