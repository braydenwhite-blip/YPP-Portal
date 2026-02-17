import { PrismaClient, TrainingStatus } from "@prisma/client";
import {
  parseArgs,
  readAcademyContent,
  validateAcademyContent,
} from "./training-academy-content-utils.mjs";

const prisma = new PrismaClient();

function normalizeQuestionOptions(options) {
  return (Array.isArray(options) ? options : [])
    .map((option) => String(option).trim())
    .filter(Boolean);
}

async function upsertModule(definition, dryRun, counters) {
  const existing = await prisma.trainingModule.findFirst({
    where: {
      OR: [{ contentKey: definition.contentKey }, { title: definition.title }],
    },
    select: {
      id: true,
      contentKey: true,
      title: true,
    },
  });

  const data = {
    contentKey: definition.contentKey,
    title: definition.title,
    description: definition.description,
    type: definition.type,
    required: Boolean(definition.required),
    sortOrder: Number(definition.sortOrder),
    videoUrl: definition.videoUrl || null,
    videoProvider: definition.videoProvider || null,
    videoDuration:
      definition.videoDuration === null || definition.videoDuration === undefined
        ? null
        : Number(definition.videoDuration),
    requiresQuiz: Boolean(definition.requiresQuiz),
    requiresEvidence: Boolean(definition.requiresEvidence),
    passScorePct: Number(definition.passScorePct),
    // New v2.0.0 fields
    estimatedMinutes: definition.estimatedMinutes ? Number(definition.estimatedMinutes) : null,
    transcript: definition.transcript || null,
  };

  if (!existing) {
    counters.modulesCreated += 1;
    if (dryRun) {
      return { id: `dry_${definition.contentKey}`, created: true };
    }
    const created = await prisma.trainingModule.create({ data, select: { id: true } });
    return { id: created.id, created: true };
  }

  counters.modulesUpdated += 1;
  if (!dryRun) {
    await prisma.trainingModule.update({
      where: { id: existing.id },
      data,
    });
  }

  return { id: existing.id, created: false };
}

async function upsertCheckpoint(moduleId, checkpoint, dryRun, counters) {
  const existing = await prisma.trainingCheckpoint.findFirst({
    where: {
      moduleId,
      OR: [{ contentKey: checkpoint.contentKey }, { title: checkpoint.title }],
    },
    select: { id: true },
  });

  const data = {
    contentKey: checkpoint.contentKey,
    title: checkpoint.title,
    description: checkpoint.description || null,
    required: Boolean(checkpoint.required),
    sortOrder: Number(checkpoint.sortOrder),
  };

  if (!existing) {
    counters.checkpointsCreated += 1;
    if (!dryRun) {
      await prisma.trainingCheckpoint.create({
        data: {
          moduleId,
          ...data,
        },
      });
    }
    return;
  }

  counters.checkpointsUpdated += 1;
  if (!dryRun) {
    await prisma.trainingCheckpoint.update({
      where: { id: existing.id },
      data,
    });
  }
}

async function upsertQuizQuestion(moduleId, question, dryRun, counters) {
  const existing = await prisma.trainingQuizQuestion.findFirst({
    where: {
      moduleId,
      OR: [{ contentKey: question.contentKey }, { question: question.question }],
    },
    select: { id: true },
  });

  const data = {
    contentKey: question.contentKey,
    question: question.question,
    options: normalizeQuestionOptions(question.options),
    correctAnswer: question.correctAnswer,
    explanation: question.explanation || null,
    sortOrder: Number(question.sortOrder),
  };

  if (!existing) {
    counters.quizCreated += 1;
    if (!dryRun) {
      await prisma.trainingQuizQuestion.create({
        data: {
          moduleId,
          ...data,
        },
      });
    }
    return;
  }

  counters.quizUpdated += 1;
  if (!dryRun) {
    await prisma.trainingQuizQuestion.update({
      where: { id: existing.id },
      data,
    });
  }
}

async function upsertVideo(moduleId, video, dryRun, counters) {
  const existing = await prisma.trainingVideo.findFirst({
    where: {
      moduleId,
      title: video.title,
    },
    select: { id: true },
  });

  const data = {
    title: video.title,
    description: video.description || null,
    videoUrl: video.videoUrl,
    videoProvider: video.videoProvider,
    videoDuration: Number(video.videoDuration),
    sortOrder: Number(video.sortOrder),
    isSupplementary: Boolean(video.isSupplementary),
  };

  if (!existing) {
    counters.videosCreated += 1;
    if (dryRun) {
      return { id: `dry_video_${video.title}` };
    }
    const created = await prisma.trainingVideo.create({
      data: {
        moduleId,
        ...data,
      },
      select: { id: true },
    });
    return { id: created.id };
  }

  counters.videosUpdated += 1;
  if (!dryRun) {
    await prisma.trainingVideo.update({
      where: { id: existing.id },
      data,
    });
  }

  return { id: existing.id };
}

async function upsertVideoSegment(videoId, segment, dryRun, counters) {
  const existing = await prisma.videoSegment.findFirst({
    where: {
      videoId,
      title: segment.title,
    },
    select: { id: true },
  });

  const data = {
    title: segment.title,
    startTime: Number(segment.startTime),
    endTime: Number(segment.endTime),
    sortOrder: Number(segment.sortOrder),
  };

  if (!existing) {
    counters.segmentsCreated += 1;
    if (!dryRun) {
      await prisma.videoSegment.create({
        data: {
          videoId,
          ...data,
        },
      });
    }
    return;
  }

  counters.segmentsUpdated += 1;
  if (!dryRun) {
    await prisma.videoSegment.update({
      where: { id: existing.id },
      data,
    });
  }
}

async function upsertResource(moduleId, resource, dryRun, counters) {
  const existing = await prisma.trainingResource.findFirst({
    where: {
      moduleId,
      title: resource.title,
    },
    select: { id: true },
  });

  const data = {
    title: resource.title,
    description: resource.description || null,
    resourceUrl: resource.resourceUrl,
    resourceType: resource.resourceType,
    sortOrder: Number(resource.sortOrder),
  };

  if (!existing) {
    counters.resourcesCreated += 1;
    if (!dryRun) {
      await prisma.trainingResource.create({
        data: {
          moduleId,
          ...data,
        },
      });
    }
    return;
  }

  counters.resourcesUpdated += 1;
  if (!dryRun) {
    await prisma.trainingResource.update({
      where: { id: existing.id },
      data,
    });
  }
}

async function pruneModuleChildren(moduleId, checkpointKeys, questionKeys, videoTitles, resourceTitles, dryRun, counters) {
  if (!dryRun) {
    const [checkpointDeleteResult, questionDeleteResult, videoDeleteResult, resourceDeleteResult] = await Promise.all([
      prisma.trainingCheckpoint.deleteMany({
        where: {
          moduleId,
          contentKey: { not: null, notIn: checkpointKeys },
        },
      }),
      prisma.trainingQuizQuestion.deleteMany({
        where: {
          moduleId,
          contentKey: { not: null, notIn: questionKeys },
        },
      }),
      prisma.trainingVideo.deleteMany({
        where: {
          moduleId,
          title: { notIn: videoTitles },
        },
      }),
      prisma.trainingResource.deleteMany({
        where: {
          moduleId,
          title: { notIn: resourceTitles },
        },
      }),
    ]);
    counters.checkpointsDeleted += checkpointDeleteResult.count;
    counters.quizDeleted += questionDeleteResult.count;
    counters.videosDeleted += videoDeleteResult.count;
    counters.resourcesDeleted += resourceDeleteResult.count;
    return;
  }

  const [checkpointDeleteCount, questionDeleteCount, videoDeleteCount, resourceDeleteCount] = await Promise.all([
    prisma.trainingCheckpoint.count({
      where: {
        moduleId,
        contentKey: { not: null, notIn: checkpointKeys },
      },
    }),
    prisma.trainingQuizQuestion.count({
      where: {
        moduleId,
        contentKey: { not: null, notIn: questionKeys },
      },
    }),
    prisma.trainingVideo.count({
      where: {
        moduleId,
        title: { notIn: videoTitles },
      },
    }),
    prisma.trainingResource.count({
      where: {
        moduleId,
        title: { notIn: resourceTitles },
      },
    }),
  ]);

  counters.checkpointsDeleted += checkpointDeleteCount;
  counters.quizDeleted += questionDeleteCount;
  counters.videosDeleted += videoDeleteCount;
  counters.resourcesDeleted += resourceDeleteCount;
}

async function syncAssignmentsForRequiredModules(moduleIds, dryRun, counters) {
  if (moduleIds.length === 0) return;

  const instructors = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: "INSTRUCTOR",
        },
      },
    },
    select: { id: true },
  });

  const assignmentData = [];
  for (const instructor of instructors) {
    for (const moduleId of moduleIds) {
      assignmentData.push({
        userId: instructor.id,
        moduleId,
        status: TrainingStatus.NOT_STARTED,
      });
    }
  }

  if (assignmentData.length === 0) return;

  if (dryRun) {
    let newCount = 0;
    for (const assignment of assignmentData) {
      const existing = await prisma.trainingAssignment.findUnique({
        where: {
          userId_moduleId: {
            userId: assignment.userId,
            moduleId: assignment.moduleId,
          },
        },
        select: { id: true },
      });
      if (!existing) newCount += 1;
    }
    counters.assignmentsCreated += newCount;
    return;
  }

  const result = await prisma.trainingAssignment.createMany({
    data: assignmentData,
    skipDuplicates: true,
  });
  counters.assignmentsCreated += result.count;
}

async function pruneModules(importedModuleKeys, dryRun, counters) {
  if (!dryRun) {
    const deleteResult = await prisma.trainingModule.deleteMany({
      where: {
        contentKey: {
          not: null,
          notIn: importedModuleKeys,
        },
      },
    });
    counters.modulesDeleted += deleteResult.count;
    return;
  }

  const deleteCount = await prisma.trainingModule.count({
    where: {
      contentKey: {
        not: null,
        notIn: importedModuleKeys,
      },
    },
  });
  counters.modulesDeleted += deleteCount;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { absolutePath, content } = readAcademyContent(args.file);
  const { errors, warnings } = validateAcademyContent(content);

  if (warnings.length > 0) {
    console.log("[training:import] Warnings:");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.error("[training:import] Validation errors:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const counters = {
    modulesCreated: 0,
    modulesUpdated: 0,
    modulesDeleted: 0,
    checkpointsCreated: 0,
    checkpointsUpdated: 0,
    checkpointsDeleted: 0,
    quizCreated: 0,
    quizUpdated: 0,
    quizDeleted: 0,
    videosCreated: 0,
    videosUpdated: 0,
    videosDeleted: 0,
    segmentsCreated: 0,
    segmentsUpdated: 0,
    resourcesCreated: 0,
    resourcesUpdated: 0,
    resourcesDeleted: 0,
    assignmentsCreated: 0,
  };

  const importedModuleKeys = [];
  const requiredModuleIds = [];

  for (const moduleDefinition of content.modules) {
    importedModuleKeys.push(moduleDefinition.contentKey);
    const moduleResult = await upsertModule(moduleDefinition, args.dryRun, counters);
    const moduleId = moduleResult.id;

    if (moduleDefinition.required === true) {
      requiredModuleIds.push(moduleId);
    }

    const checkpointKeys = [];
    for (const checkpoint of moduleDefinition.checkpoints || []) {
      checkpointKeys.push(checkpoint.contentKey);
      if (!args.dryRun || !moduleId.startsWith("dry_")) {
        await upsertCheckpoint(moduleId, checkpoint, args.dryRun, counters);
      } else {
        counters.checkpointsCreated += 1;
      }
    }

    const questionKeys = [];
    for (const question of moduleDefinition.quizQuestions || []) {
      questionKeys.push(question.contentKey);
      if (!args.dryRun || !moduleId.startsWith("dry_")) {
        await upsertQuizQuestion(moduleId, question, args.dryRun, counters);
      } else {
        counters.quizCreated += 1;
      }
    }

    // Process videos (v2.0.0 schema)
    const videoTitles = [];
    for (const video of moduleDefinition.videos || []) {
      videoTitles.push(video.title);
      if (!args.dryRun || !moduleId.startsWith("dry_")) {
        const videoResult = await upsertVideo(moduleId, video, args.dryRun, counters);
        const videoId = videoResult.id;

        // Process video segments
        for (const segment of video.segments || []) {
          if (!args.dryRun || !videoId.startsWith("dry_")) {
            await upsertVideoSegment(videoId, segment, args.dryRun, counters);
          } else {
            counters.segmentsCreated += 1;
          }
        }
      } else {
        counters.videosCreated += 1;
      }
    }

    // Process resources (v2.0.0 schema)
    const resourceTitles = [];
    for (const resource of moduleDefinition.resources || []) {
      resourceTitles.push(resource.title);
      if (!args.dryRun || !moduleId.startsWith("dry_")) {
        await upsertResource(moduleId, resource, args.dryRun, counters);
      } else {
        counters.resourcesCreated += 1;
      }
    }

    if (args.prune && (!args.dryRun || !moduleId.startsWith("dry_"))) {
      await pruneModuleChildren(moduleId, checkpointKeys, questionKeys, videoTitles, resourceTitles, args.dryRun, counters);
    }
  }

  if (args.prune) {
    await pruneModules(importedModuleKeys, args.dryRun, counters);
  }

  await syncAssignmentsForRequiredModules(
    requiredModuleIds.filter((moduleId) => !String(moduleId).startsWith("dry_")),
    args.dryRun,
    counters
  );

  console.log(`[training:import] File: ${absolutePath}`);
  console.log(`[training:import] Dry run: ${args.dryRun ? "yes" : "no"}`);
  console.log(`[training:import] Prune: ${args.prune ? "yes" : "no"}`);
  console.log("[training:import] Summary:");
  console.log(`- modules created: ${counters.modulesCreated}`);
  console.log(`- modules updated: ${counters.modulesUpdated}`);
  console.log(`- modules deleted: ${counters.modulesDeleted}`);
  console.log(`- checkpoints created: ${counters.checkpointsCreated}`);
  console.log(`- checkpoints updated: ${counters.checkpointsUpdated}`);
  console.log(`- checkpoints deleted: ${counters.checkpointsDeleted}`);
  console.log(`- quiz questions created: ${counters.quizCreated}`);
  console.log(`- quiz questions updated: ${counters.quizUpdated}`);
  console.log(`- quiz questions deleted: ${counters.quizDeleted}`);
  console.log(`- videos created: ${counters.videosCreated}`);
  console.log(`- videos updated: ${counters.videosUpdated}`);
  console.log(`- videos deleted: ${counters.videosDeleted}`);
  console.log(`- video segments created: ${counters.segmentsCreated}`);
  console.log(`- video segments updated: ${counters.segmentsUpdated}`);
  console.log(`- resources created: ${counters.resourcesCreated}`);
  console.log(`- resources updated: ${counters.resourcesUpdated}`);
  console.log(`- resources deleted: ${counters.resourcesDeleted}`);
  console.log(`- assignments created: ${counters.assignmentsCreated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
