import { MetaTag } from "@/lib/types";
import { expect, test } from "vitest";
import { IntegrationHarness } from "../utils/integration";

test("GET /metatags", async (ctx) => {
  const h = new IntegrationHarness(ctx);
  const { http } = await h.init();

  const { status, data: metatags } = await http.get<MetaTag>({
    path: `/metatags`,
    query: {
      url: "https://thereflist.com",
    },
  });

  expect(status).toEqual(200);
  expect(metatags).toStrictEqual({
    title: "RefList - Affiliate Links for Everyone",
    description:
      "RefList is the open-source link management platform for modern marketing teams to create marketing campaigns, link sharing features, and referral programs.",
    image: "https://assets.dub.co/thumbnail.jpg",
    poweredBy: "RefList - Affiliate Links for Everyone",
  });
});
