import { determineCustomerDiscount } from "@/lib/api/customers/determine-customer-discount";
import { getCustomerOrThrow } from "@/lib/api/customers/get-customer-or-throw";
import { transformCustomer } from "@/lib/api/customers/transform-customer";
import { DubApiError } from "@/lib/api/errors";
import { parseRequestBody } from "@/lib/api/utils";
import { withWorkspace } from "@/lib/auth";
import { isStored, storage } from "@/lib/storage";
import {
  CustomerEnrichedSchema,
  CustomerSchema,
  getCustomersQuerySchema,
  updateCustomerBodySchema,
} from "@/lib/zod/schemas/customers";
import { prisma } from "@dub/prisma";
import { nanoid, R2_URL } from "@dub/utils";
import { Discount } from "@prisma/client";
import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";

// GET /api/customers/[id] – Get a specific customer
export const GET = withWorkspace(
  async ({ params, searchParams, workspace }) => {
    const { id } = params;
    
    // Handle 'undefined' or invalid customer ID gracefully
    if (!id || id === 'undefined') {
      return NextResponse.json(
        { error: "Invalid customer ID" },
        { status: 400 }
      );
    }
    
    const { includeExpandedFields } = getCustomersQuerySchema.parse(searchParams);

    let customer;
    try {
      // If the id starts with ext_, use externalId lookup
      if (id.startsWith("ext_")) {
        const externalId = id.replace("ext_", "");
        customer = await prisma.customer.findUnique({
          where: {
            projectId_externalId: {
              projectId: workspace.id,
              externalId,
            },
          },
        });
      } else {
        customer = await prisma.customer.findUnique({
          where: {
            id,
            projectId: workspace.id,
          },
        });
      }
      
      if (!customer) {
        throw new DubApiError({
          code: "not_found",
          message: "Customer not found.",
        });
      }
      
      return NextResponse.json(
        CustomerSchema.parse(transformCustomer(customer)),
      );
    } catch (error) {
      if (error instanceof DubApiError) {
        throw error;
      }
      
      console.error("Error fetching customer:", error);
      return NextResponse.json(
        { error: "Error fetching customer" },
        { status: 500 }
      );
    }
  },
  {
    requiredPlan: ["free", "pro", "business", "business plus", "business extra", "business max", "advanced", "enterprise"],
  },
);

// PATCH /api/customers/[id] – Update a customer
export const PATCH = withWorkspace(
  async ({ req, params, workspace }) => {
    const { id } = params;
    
    // Handle 'undefined' or invalid customer ID gracefully
    if (!id || id === 'undefined') {
      return NextResponse.json(
        { error: "Invalid customer ID" },
        { status: 400 }
      );
    }
    
    const body = updateCustomerBodySchema.parse(await parseRequestBody(req));

    const customer = await getCustomerOrThrow({
      id,
      workspaceId: workspace.id,
    });

    const updatedCustomer = await prisma.customer.update({
      where: {
        id: customer.id,
        projectId: workspace.id,
      },
      data: body,
    });

    return NextResponse.json(
      CustomerSchema.parse(transformCustomer(updatedCustomer)),
    );
  },
  {
    requiredPlan: ["free", "pro", "business", "business plus", "business extra", "business max", "advanced", "enterprise"],
  },
);

// DELETE /api/customers/[id] – Delete a customer
export const DELETE = withWorkspace(
  async ({ params, workspace }) => {
    const { id } = params;
    
    // Handle 'undefined' or invalid customer ID gracefully
    if (!id || id === 'undefined') {
      return NextResponse.json(
        { error: "Invalid customer ID" },
        { status: 400 }
      );
    }

    const customer = await getCustomerOrThrow({
      id,
      workspaceId: workspace.id,
    });

    await prisma.customer.delete({
      where: {
        id: customer.id,
        projectId: workspace.id,
      },
    });

    return new NextResponse(null, { status: 204 });
  },
  {
    requiredPlan: ["free", "pro", "business", "business plus", "business extra", "business max", "advanced", "enterprise"],
  },
);
