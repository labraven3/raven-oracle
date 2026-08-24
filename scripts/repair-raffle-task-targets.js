const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.raffleTask.findMany({
    where: {
      OR: [
        { targetUrl: null },
        { targetUrl: "" },
      ],
    },
    include: {
      raffle: {
        select: {
          project: {
            select: { xUrl: true, discordUrl: true },
          },
        },
      },
    },
  });

  let fixed = 0;
  let missing = 0;

  for (const task of tasks) {
    const project = task.raffle.project;
    let targetUrl = null;

    if (task.type === "X_FOLLOW") targetUrl = project?.xUrl ?? null;
    if (task.type === "DISCORD_JOIN") targetUrl = project?.discordUrl ?? null;
    if ((task.type === "X_LIKE" || task.type === "X_REPOST") && /^https?:\/\//i.test(task.target)) {
      targetUrl = task.target;
    }

    if (targetUrl) {
      await prisma.raffleTask.update({ where: { id: task.id }, data: { targetUrl } });
      fixed += 1;
    } else {
      missing += 1;
      console.log(`⚠️ Could not derive target URL for ${task.id} (${task.type}): ${task.target}`);
    }
  }

  console.log(`✅ Repaired ${fixed} raffle task target URL(s).`);
  if (missing) console.log(`⚠️ ${missing} task(s) still need a real target URL in Creator Studio.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
