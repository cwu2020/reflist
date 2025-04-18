import z from "@/lib/zod";
import { bulkUpdateLinksBodySchema } from "@/lib/zod/schemas/links";
import { prisma } from "@dub/prisma";
import { Prisma } from "@dub/prisma/client";
import { R2_URL, nanoid } from "@dub/utils";
import { storage } from "@/lib/storage";
import { waitUntil } from "@vercel/functions";
import { combineTagIds } from "../tags/combine-tag-ids";
import { propagateBulkLinkChanges } from "./propagate-bulk-link-changes";
import { transformLink } from "./utils";

export async function bulkUpdateLinks({
  linkIds,
  externalIds,
  data,
  workspaceId,
  userId,
}: {
  linkIds?: string[];
  externalIds?: string[];
  data: z.infer<typeof bulkUpdateLinksBodySchema>["data"];
  workspaceId: string;
  userId: string;
}) {
  const {
    url,
    title,
    description,
    image,
    proxy,
    folderId,
    tagId,
    tagIds,
    tagNames,
    webhookIds,
    expiresAt,
    geo,
    testVariants,
    testStartedAt,
    testCompletedAt
  } = data;

  // If linkIds is provided, use it to update links
  if (linkIds && linkIds.length > 0) {
    const imageUrlNonce = nanoid(7);
    const imageUrl = image
      ? `${R2_URL}/images/${linkIds[0]}_${imageUrlNonce}`
      : null;

    // Upload image to R2 if provided
    if (image && imageUrl) {
      await storage.upload(`images/${linkIds[0]}_${imageUrlNonce}`, image);
    }

    // Update links in database
    return await prisma.$transaction(
      linkIds.map((linkId) =>
        prisma.link.update({
          where: {
            id: linkId,
          },
          data: {
            url,
            title,
            description,
            image: imageUrl,
            proxy,
            folderId,
            tags: {
              deleteMany: {},
              ...(tagId && {
                create: {
                  tagId,
                }
              }),
              ...(tagIds?.length && {
                createMany: {
                  data: tagIds.map(id => ({ tagId: id })),
                }
              })
            },
            webhooks: webhookIds ? {
              deleteMany: {},
              createMany: {
                data: webhookIds.map(id => ({ webhookId: id })),
              }
            } : undefined,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            geo: geo || Prisma.JsonNull,
            testVariants: testVariants || Prisma.JsonNull,
            testStartedAt: testStartedAt ? new Date(testStartedAt) : null,
            testCompletedAt: testCompletedAt ? new Date(testCompletedAt) : null,
            updatedAt: new Date(),
            userId,
          },
        })
      )
    );
  }

  // If externalIds is provided, use it to update links
  if (externalIds && externalIds.length > 0) {
    return await prisma.$transaction(
      externalIds.map((externalId) =>
        prisma.link.update({
          where: {
            projectId_externalId: {
              projectId: workspaceId,
              externalId,
            },
          },
          data: {
            url,
            title,
            description,
            image,
            proxy,
            folderId,
            tags: {
              deleteMany: {},
              ...(tagId && {
                create: {
                  tagId,
                }
              }),
              ...(tagIds?.length && {
                createMany: {
                  data: tagIds.map(id => ({ tagId: id })),
                }
              })
            },
            webhooks: webhookIds ? {
              deleteMany: {},
              createMany: {
                data: webhookIds.map(id => ({ webhookId: id })),
              }
            } : undefined,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            geo: geo || Prisma.JsonNull,
            testVariants: testVariants || Prisma.JsonNull,
            testStartedAt: testStartedAt ? new Date(testStartedAt) : null,
            testCompletedAt: testCompletedAt ? new Date(testCompletedAt) : null,
            updatedAt: new Date(),
            userId,
          },
        })
      )
    );
  }

  return [];
}
