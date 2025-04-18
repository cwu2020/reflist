import { DubApiError, exceededLimitError } from "@/lib/api/errors";
import {
  bulkCreateLinks,
  checkIfLinksHaveTags,
  checkIfLinksHaveWebhooks,
  processLink,
} from "@/lib/api/links";
import { bulkDeleteLinks } from "@/lib/api/links/bulk-delete-links";
import { bulkUpdateLinks } from "@/lib/api/links/bulk-update-links";
import { throwIfLinksUsageExceeded } from "@/lib/api/links/usage-checks";
import { checkIfLinksHaveFolders } from "@/lib/api/links/utils/check-if-links-have-folders";
import { combineTagIds } from "@/lib/api/tags/combine-tag-ids";
import { parseRequestBody } from "@/lib/api/utils";
import { withWorkspace } from "@/lib/auth";
import {
  checkFolderPermissions,
  verifyFolderAccess,
} from "@/lib/folder/permissions";
import { storage } from "@/lib/storage";
import { NewLinkProps, ProcessedLinkProps } from "@/lib/types";
import {
  bulkCreateLinksBodySchema,
  bulkUpdateLinksBodySchema,
} from "@/lib/zod/schemas/links";
import { prisma } from "@dub/prisma";
import { R2_URL } from "@dub/utils";
import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { z } from "zod";

// POST /api/links/bulk – bulk create up to 100 links
export const POST = withWorkspace(
  async ({ req, headers, session, workspace }) => {
    if (!workspace) {
      throw new DubApiError({
        code: "bad_request",
        message:
          "Missing workspace. Bulk link creation is only available for custom domain workspaces.",
      });
    }

    throwIfLinksUsageExceeded(workspace);

    const links = bulkCreateLinksBodySchema.parse(await parseRequestBody(req));
    if (
      workspace.linksUsage + links.length > workspace.linksLimit &&
      (workspace.plan === "free" || workspace.plan === "pro")
    ) {
      throw new DubApiError({
        code: "exceeded_limit",
        message: exceededLimitError({
          plan: workspace.plan,
          limit: workspace.linksLimit,
          type: "links",
        }),
      });
    }

    // check if any of the links have a defined key and the domain + key combination is the same
    const duplicates = links.filter(
      (link, index, self) =>
        link.key &&
        self
          .slice(index + 1)
          .some((l) => l.domain === link.domain && l.key === link.key),
    );

    if (duplicates.length > 0) {
      throw new DubApiError({
        code: "bad_request",
        message: `Duplicate links found: ${duplicates
          .map((link) => `${link.domain}/${link.key}`)
          .join(", ")}`,
      });
    }

    const processedLinks = await Promise.all(
      links.map(async (link) =>
        processLink({
          payload: link,
          workspace,
          userId: session.user.id,
          bulk: true,
          skipExternalIdChecks: true,
        }),
      ),
    );

    let validLinks = processedLinks
      .filter(({ error }) => error == null)
      .map(({ link }) => link) as ProcessedLinkProps[];

    let errorLinks = processedLinks
      .filter(({ error }) => error != null)
      .map(({ link, error, code }) => ({
        link,
        error,
        code,
      }));

    if (checkIfLinksHaveTags(validLinks)) {
      // filter out tags that don't belong to the workspace
      const tagIds = validLinks
        .map((link) =>
          combineTagIds({ tagId: link.tagId, tagIds: link.tagIds }),
        )
        .flat()
        .filter(Boolean) as string[];
      const tagNames = validLinks
        .map((link) => link.tagNames)
        .flat()
        .filter(Boolean) as string[];

      const workspaceTags = await prisma.tag.findMany({
        where: {
          projectId: workspace.id,
          ...(tagIds.length > 0 ? { id: { in: tagIds } } : {}),
          ...(tagNames.length > 0 ? { name: { in: tagNames } } : {}),
        },
        select: {
          id: true,
          name: true,
        },
      });

      const workspaceTagIds = workspaceTags.map(({ id }) => id);
      const workspaceTagNames = workspaceTags.map(({ name }) =>
        name.toLowerCase(),
      );

      validLinks.forEach((link, index) => {
        const combinedTagIds =
          combineTagIds({
            tagId: link.tagId,
            tagIds: link.tagIds,
          }) ?? [];

        const invalidTagIds = combinedTagIds.filter(
          (id) => !workspaceTagIds.includes(id),
        );

        if (invalidTagIds.length > 0) {
          // remove link from validLinks and add error to errorLinks
          validLinks = validLinks.filter((_, i) => i !== index);
          errorLinks.push({
            error: `Invalid tagIds detected: ${invalidTagIds.join(", ")}`,
            code: "unprocessable_entity",
            link,
          });
        }

        const invalidTagNames = link.tagNames?.filter(
          (name) => !workspaceTagNames.includes(name.toLowerCase()),
        );

        if (invalidTagNames?.length) {
          validLinks = validLinks.filter((_, i) => i !== index);
          errorLinks.push({
            error: `Invalid tagNames detected: ${invalidTagNames.join(", ")}`,
            code: "unprocessable_entity",
            link,
          });
        }
      });
    }

    if (checkIfLinksHaveFolders(validLinks.map(link => ({ folderId: link.folderId })))) {
      // filter out folders that don't belong to the workspace
      const folderIds = [
        ...new Set(
          links.map((link) => link.folderId).filter((id): id is string => id !== null),
        ),
      ];

      const folderPermissions = await checkFolderPermissions({
        workspaceId: workspace.id,
        userId: session.user.id,
        folderIds,
        requiredPermission: "folders.links.write",
      });

      validLinks = validLinks.filter((link) => {
        if (!link.folderId) {
          return true;
        }

        const validFolder = folderPermissions.find(
          (folder) => folder.folderId === link.folderId,
        );

        if (!validFolder) {
          errorLinks.push({
            error: `Invalid folderId detected: ${link.folderId}`,
            code: "unprocessable_entity",
            link,
          });

          return false;
        }

        if (!validFolder.hasPermission) {
          errorLinks.push({
            error: `You don't have write access to the folder: ${link.folderId}`,
            code: "forbidden",
            link,
          });

          return false;
        }

        return true;
      });
    }

    if (checkIfLinksHaveWebhooks(validLinks)) {
      if (workspace.plan === "free" || workspace.plan === "pro") {
        throw new DubApiError({
          code: "forbidden",
          message:
            "You can only use webhooks on a Business plan and above. Upgrade to Business to use this feature.",
        });
      }

      const webhookIds = validLinks
        .map((link) => link.webhookIds)
        .flat()
        .filter(Boolean) as string[];

      const webhooks = await prisma.webhook.findMany({
        where: { projectId: workspace.id, id: { in: webhookIds } },
      });

      const workspaceWebhookIds = webhooks.map(({ id }) => id);

      validLinks.forEach((link, index) => {
        const invalidWebhookIds = link.webhookIds?.filter(
          (id) => !workspaceWebhookIds.includes(id),
        );
        if (invalidWebhookIds && invalidWebhookIds.length > 0) {
          validLinks = validLinks.filter((_, i) => i !== index);
          errorLinks.push({
            error: `Invalid webhookIds detected: ${invalidWebhookIds.join(", ")}`,
            code: "unprocessable_entity",
            link,
          });
        }
      });
    }

    const validLinksResponse =
      validLinks.length > 0 ? await bulkCreateLinks({ links: validLinks }) : [];

    return NextResponse.json([...validLinksResponse, ...errorLinks], {
      headers,
    });
  },
  {
    requiredPermissions: ["links.write"],
  },
);

// PATCH /api/links/bulk – bulk update up to 100 links with the same data
export const PUT = withWorkspace(
  async ({ req, headers, session, workspace }) => {
    if (!workspace) {
      throw new DubApiError({
        code: "bad_request",
        message:
          "Missing workspace. Bulk link update is only available for custom domain workspaces.",
      });
    }

    const { linkIds = [], externalIds = [], data } = bulkUpdateLinksBodySchema.parse(
      await parseRequestBody(req),
    );

    // Ensure arrays are defined and not empty
    if (!Array.isArray(linkIds) || !Array.isArray(externalIds)) {
      throw new DubApiError({
        code: "bad_request",
        message: "linkIds and externalIds must be arrays",
      });
    }

    if (linkIds.length === 0 && externalIds.length === 0) {
      throw new DubApiError({
        code: "bad_request",
        message: "No links provided",
      });
    }

    // Process links
    const processedLinks = await Promise.all(
      linkIds.map(async (linkId) =>
        processLink({
          payload: {
            ...data,
            id: linkId,
            url: data.url || "", // Ensure url is not undefined
          },
          workspace,
          userId: session.user.id,
          bulk: true,
          skipExternalIdChecks: true,
        }),
      ),
    );

    let validLinks = processedLinks
      .filter(({ error }) => error == null)
      .map(({ link }) => link) as ProcessedLinkProps[];

    let errorLinks = processedLinks
      .filter(({ error }) => error != null)
      .map(({ link, error, code }) => ({
        link,
        error,
        code,
      }));

    // Check for folders
    if (checkIfLinksHaveFolders(validLinks.map(link => ({ folderId: link.folderId })))) {
      const folderIds = validLinks
        .map((link) => link.folderId)
        .filter((id): id is string => id !== null);

      if (folderIds.length > 0) {
        await verifyFolderAccess({
          workspace,
          userId: session.user.id,
          folderId: folderIds[0], // Since we're checking one folder at a time
          requiredPermission: "folders.links.write",
        });
      }
    }

    // Update links
    const result = await bulkUpdateLinks({
      linkIds: validLinks.map((link) => link.id).filter((id): id is string => id !== undefined),
      externalIds: externalIds.filter((id): id is string => id !== undefined),
      data: {
        ...data,
        url: data.url || "",
        tagNames: data.tagNames || undefined,
        expiresAt: data.expiresAt || null,
        geo: data.geo || undefined,
        testVariants: data.testVariants || undefined,
        testCompletedAt: data.testCompletedAt || null,
        testStartedAt: data.testStartedAt || null,
      },
      workspaceId: workspace.id,
      userId: session.user.id,
    });

    return NextResponse.json(result);
  },
  {
    requiredPermissions: ["links.write"],
  },
);

// DELETE /api/links/bulk – bulk delete up to 100 links
export const DELETE = withWorkspace(
  async ({ workspace, headers, searchParams, session }) => {
    const searchParamsLinkIds = searchParams["linkIds"]
      ? searchParams["linkIds"].split(",")
      : [];

    if (searchParamsLinkIds.length === 0) {
      throw new DubApiError({
        code: "bad_request",
        message:
          "Please provide linkIds to delete. You may use `linkId` or `externalId` prefixed with `ext_` as comma separated values.",
      });
    }

    const linkIds = new Set<string>();
    const externalIds = new Set<string>();

    searchParamsLinkIds.map((id) => {
      id = id.trim();

      if (id.startsWith("ext_")) {
        externalIds.add(id.replace("ext_", ""));
      } else {
        linkIds.add(id);
      }
    });

    if (linkIds.size === 0 && externalIds.size === 0) {
      throw new DubApiError({
        code: "bad_request",
        message:
          "Please provide linkIds to delete. You may use `linkId` or `externalId` prefixed with `ext_` as comma separated values.",
      });
    }

    let links = await prisma.link.findMany({
      where: {
        projectId: workspace.id,
        programId: null,
        OR: [
          ...(linkIds.size > 0 ? [{ id: { in: Array.from(linkIds) } }] : []),
          ...(externalIds.size > 0
            ? [{ externalId: { in: Array.from(externalIds) } }]
            : []),
        ],
      },
      include: {
        tags: {
          select: {
            tag: true,
          },
        },
      },
    });

    if (checkIfLinksHaveFolders(links)) {
      const folderIds = [
        ...new Set(
          links.map((link) => link.folderId).filter((id): id is string => id !== null),
        ),
      ];

      const folderPermissions = await checkFolderPermissions({
        workspaceId: workspace.id,
        userId: session.user.id,
        folderIds,
        requiredPermission: "folders.links.write",
      });

      links = links.filter((link) => {
        if (!link.folderId) {
          return true;
        }

        const validFolder = folderPermissions.find(
          (folder) => folder.folderId === link.folderId,
        );

        return validFolder?.hasPermission ?? false;
      });
    }

    const { count: deletedCount } = await prisma.link.deleteMany({
      where: {
        id: { in: links.map((link) => link.id) },
        projectId: workspace.id,
      },
    });

    waitUntil(bulkDeleteLinks(links));

    return NextResponse.json(
      {
        deletedCount,
      },
      { headers },
    );
  },
  {
    requiredPermissions: ["links.write"],
  },
);
