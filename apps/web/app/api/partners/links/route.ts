import { DubApiError, ErrorCodes } from "@/lib/api/errors";
import { createLink, processLink } from "@/lib/api/links";
import { processLinkWithPartner } from "@/lib/api/links/process-link-with-partner";
import { getProgramOrThrow } from "@/lib/api/programs/get-program-or-throw";
import { parseRequestBody } from "@/lib/api/utils";
import { withWorkspace } from "@/lib/auth";
import { sendWorkspaceWebhook } from "@/lib/webhook/publish";
import { linkEventSchema } from "@/lib/zod/schemas/links";
import {
  createPartnerLinkSchema,
  retrievePartnerLinksSchema,
} from "@/lib/zod/schemas/partners";
import { ProgramPartnerLinkSchema } from "@/lib/zod/schemas/programs";
import { prisma } from "@dub/prisma";
import { getApexDomain } from "@dub/utils";
import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { z } from "zod";

// GET /api/partners/links - get the partner links
export const GET = withWorkspace(
  async ({ workspace, searchParams }) => {
    const { programId, partnerId, tenantId } =
      retrievePartnerLinksSchema.parse(searchParams);

    await getProgramOrThrow({
      programId,
      workspaceId: workspace.id,
    });

    const programEnrollment = await prisma.programEnrollment.findUnique({
      where: partnerId
        ? {
            partnerId_programId: {
              partnerId,
              programId,
            },
          }
        : {
            tenantId_programId: {
              tenantId: tenantId as string,
              programId,
            },
          },
      select: {
        links: true,
      },
    });

    if (!programEnrollment) {
      throw new DubApiError({
        code: "not_found",
        message: "Partner not found.",
      });
    }

    const { links } = programEnrollment;

    return NextResponse.json(z.array(ProgramPartnerLinkSchema).parse(links));
  },
  {
    requiredPlan: ["advanced", "enterprise"],
  },
);

// POST /api/partners/links - create a link for a partner
export const POST = withWorkspace(
  async ({ workspace, req, session }) => {
    const { programId, partnerId, tenantId, url, key, linkProps } =
      createPartnerLinkSchema.parse(await parseRequestBody(req));

    // Attempt to get the program first
    let program;
    try {
      program = await getProgramOrThrow({
        workspaceId: workspace.id,
        programId,
      });
    } catch (error) {
      console.warn("Program not found, will attempt to create one during link processing:", error.message);
    }

    // Check if a domain and URL exist on the program if we found one
    if (program && (!program.domain || !program.url)) {
      throw new DubApiError({
        code: "bad_request",
        message:
          "You need to set a domain and url for this program before creating a link.",
      });
    }

    if (program && url && getApexDomain(url) !== getApexDomain(program.url)) {
      throw new DubApiError({
        code: "bad_request",
        message: `The provided URL domain (${getApexDomain(url)}) does not match the program's domain (${getApexDomain(program.url)}).`,
      });
    }

    if (!partnerId && !tenantId) {
      throw new DubApiError({
        code: "bad_request",
        message: "You must provide a partnerId or tenantId.",
      });
    }

    // Check for existing partner enrollment if we have a program
    let partner;
    if (program) {
      partner = await prisma.programEnrollment.findUnique({
        where: partnerId
          ? { partnerId_programId: { partnerId, programId } }
          : { tenantId_programId: { tenantId: tenantId!, programId } },
      });

      if (!partner) {
        console.warn("Partner not found, will attempt to enroll during link processing");
      }
    }

    // Use processLinkWithPartner which includes our fallback mechanism for program and partner
    const { link, error, code } = await processLinkWithPartner({
      payload: {
        ...linkProps,
        domain: program?.domain,
        key: key || undefined,
        url: url || program?.url || url, // Ensure we have a URL if program doesn't exist
        programId: program?.id || programId, 
        tenantId,
        partnerId,
        trackConversion: true,
        folderId: program?.defaultFolderId,
      },
      workspace,
      userId: session.user.id,
      skipProgramChecks: !!program, // Only skip program checks if we already validated the program
    });

    if (error != null) {
      throw new DubApiError({
        code: code as ErrorCodes,
        message: error,
      });
    }

    const partnerLink = await createLink(link);

    console.log(`Created partner link with programId: ${partnerLink.programId || 'none'}`);

    // Send webhook
    waitUntil(
      sendWorkspaceWebhook({
        trigger: "link.created",
        workspace,
        data: linkEventSchema.parse(partnerLink),
      }),
    );

    return NextResponse.json(partnerLink, { status: 201 });
  },
  {
    requiredPlan: ["advanced", "enterprise"],
  },
);
