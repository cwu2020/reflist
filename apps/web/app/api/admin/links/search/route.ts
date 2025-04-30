import { prisma } from "@dub/prisma";
import { isDubAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  // Check if user is authenticated and is an admin
  if (!session?.user?.email || !isDubAdmin(session.user.email)) {
    return new NextResponse("Unauthorized", { status: 403 });
  }

  if (!query || query.length < 3) {
    return NextResponse.json({ links: [] });
  }

  try {
    const links = await prisma.link.findMany({
      where: {
        OR: [
          {
            key: {
              contains: query,
            },
          },
          {
            url: {
              contains: query,
            },
          },
          {
            id: query,
          },
        ],
      },
      select: {
        id: true,
        key: true,
        url: true,
        userId: true,
        user: {
          select: {
            email: true,
          },
        },
        domain: true,
      },
      take: 5,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ links });
  } catch (error) {
    console.error(error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 