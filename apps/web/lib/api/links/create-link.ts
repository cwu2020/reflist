import { qstash } from "@/lib/cron";
import { getPartnerAndDiscount } from "@/lib/planetscale/get-partner-discount";
import { isStored, storage } from "@/lib/storage";
import { recordLink } from "@/lib/tinybird";
import { ProcessedLinkProps } from "@/lib/types";
import { propagateWebhookTriggerChanges } from "@/lib/webhook/update-webhook";
import { prisma } from "@dub/prisma";
import { Prisma } from "@dub/prisma/client";
import {
  APP_DOMAIN_WITH_NGROK,
  R2_URL,
  getParamsFromURL,
  truncate,
} from "@dub/utils";
import { linkConstructorSimple } from "@dub/utils/src/functions/link-constructor";
import { waitUntil } from "@vercel/functions";
import { createId } from "../create-id";
import { combineTagIds } from "../tags/combine-tag-ids";
import { scheduleABTestCompletion } from "./ab-test-scheduler";
import { linkCache } from "./cache";
import { encodeKeyIfCaseSensitive } from "./case-sensitivity";
import { includeTags } from "./include-tags";
import { updateLinksUsage } from "./update-links-usage";
import { transformLink } from "./utils";
import { createShopMyPin, ShopMyMerchantData } from "@/lib/shopmy";
import axios from "axios";

// Create a ShopMy pin directly - bypassing our API for server-side usage
async function createShopMyPinDirectly(params: {
  title: string;
  description?: string;
  image?: string;
  link: string;
}): Promise<{ pin: any; shortUrl: string } | null> {
  try {
    const SHOPMY_API_URL = "https://api.shopmy.us/api/Pins";
    const SHOPMY_TOKEN = process.env.SHOPMY_CREATOR_TOKEN;
    const SHOPMY_USER_ID = process.env.SHOPMY_USER_ID || "104679";
    
    if (!SHOPMY_TOKEN) {
      console.error("ShopMy API token not configured");
      return null;
    }
    
    // Prepare the ShopMy API request payload
    const payload = {
      ...params,
      User_id: Number(SHOPMY_USER_ID)
    };
    
    console.log(`ShopMy direct: Request payload: ${JSON.stringify(payload)}`);
    
    // Make the direct API request to ShopMy
    const response = await axios.post(
      SHOPMY_API_URL,
      payload,
      {
        headers: {
          "Accept": "application/json, text/plain, */*",
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "x-apicache-bypass": "true",
          "x-authorization-hash": SHOPMY_TOKEN,
          "Origin": "https://shopmy.us",
          "Referer": "https://shopmy.us/"
        }
      }
    );
    
    console.log(`ShopMy direct: Response status: ${response.status}`);
    
    if (!response.data || !response.data.pin) {
      console.error("ShopMy direct: Invalid response format", response.data);
      return null;
    }
    
    const pin = response.data.pin;
    const shortUrl = `https://go.shopmy.us/p-${pin.id}`;
    
    console.log(`ShopMy direct: Created pin with ID: ${pin.id}, shortURL: ${shortUrl}`);
    
    return { pin, shortUrl };
  } catch (error) {
    console.error("ShopMy direct API error:", error);
    return null;
  }
}

export async function createLink(link: ProcessedLinkProps) {
  let {
    key,
    url,
    expiresAt,
    title,
    description,
    image,
    proxy,
    geo,
    publicStats,
    testVariants,
    testStartedAt,
    testCompletedAt,
  } = link;

  // Handle ShopMy integration if metadata is present
  const shopmyMetadata = link.shopmyMetadata as ShopMyMerchantData | undefined;
  let originalUrl = link.originalUrl;
  
  // Create a pin when shopmy metadata is present
  if (shopmyMetadata) {
    try {
      // Keep track of the original URL if not already set
      if (!originalUrl) {
        originalUrl = url;
      }
      
      // The URL to use for creating the pin should be the original URL, not a potentially abbreviated one
      const pinSourceUrl = originalUrl || url;
      
      console.log(`ShopMy: Creating pin for URL: ${pinSourceUrl}`);
      
      // Try to create a pin with the ShopMy API, first via client-side API, then directly
      let pinResult;
      
      try {
        // First try to use our library, which will go through our API endpoint
        pinResult = await createShopMyPin({
          title: shopmyMetadata.brand?.name || shopmyMetadata.name || title || '',
          description: description || '',
          image: shopmyMetadata.logo || image || '',
          link: pinSourceUrl,
        });
      } catch (clientError) {
        console.error("Error in client-side ShopMy pin creation:", clientError);
        
        // If client-side pin creation fails, try creating the pin directly with the ShopMy API
        console.log("Trying direct ShopMy API call...");
        pinResult = await createShopMyPinDirectly({
          title: shopmyMetadata.brand?.name || shopmyMetadata.name || title || '',
          description: description || '',
          image: shopmyMetadata.logo || image || '',
          link: pinSourceUrl,
        });
      }
      
      if (pinResult && pinResult.shortUrl) {
        // Replace the URL with the ShopMy URL
        url = pinResult.shortUrl;
        console.log(`ShopMy: Using shortURL: ${pinResult.shortUrl}`);
      }
    } catch (error) {
      console.error("Error creating ShopMy pin:", error);
      // Continue with the original URL if there's an error
    }
  }

  const combinedTagIds = combineTagIds(link);

  const { utm_source, utm_medium, utm_campaign, utm_term, utm_content } =
    getParamsFromURL(url);

  const { tagId, tagIds, tagNames, webhookIds, ...rest } = link;

  key = encodeKeyIfCaseSensitive({
    domain: link.domain,
    key,
  });

  const response = await prisma.link.create({
    data: {
      ...rest,
      id: createId({ prefix: "link_" }),
      key,
      url,
      originalUrl,
      shortLink: linkConstructorSimple({ domain: link.domain, key }),
      title: truncate(title, 120),
      description: truncate(description, 240),
      // if it's an uploaded image, make this null first because we'll update it later
      image: proxy && image && !isStored(image) ? null : image,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      geo: geo || Prisma.JsonNull,
      shopmyMetadata: shopmyMetadata || Prisma.JsonNull,

      testVariants: testVariants || Prisma.JsonNull,
      testCompletedAt: testCompletedAt ? new Date(testCompletedAt) : null,
      testStartedAt: testStartedAt ? new Date(testStartedAt) : null,

      // Associate tags by tagNames
      ...(tagNames?.length &&
        link.projectId && {
          tags: {
            create: tagNames.map((tagName, idx) => ({
              tag: {
                connect: {
                  name_projectId: {
                    name: tagName,
                    projectId: link.projectId as string,
                  },
                },
              },
              createdAt: new Date(new Date().getTime() + idx * 100), // increment by 100ms for correct order
            })),
          },
        }),

      // Associate tags by IDs (takes priority over tagNames)
      ...(combinedTagIds &&
        combinedTagIds.length > 0 && {
          tags: {
            createMany: {
              data: combinedTagIds.map((tagId, idx) => ({
                tagId,
                createdAt: new Date(new Date().getTime() + idx * 100), // increment by 100ms for correct order
              })),
            },
          },
        }),

      // Webhooks
      ...(webhookIds &&
        webhookIds.length > 0 && {
          webhooks: {
            createMany: {
              data: webhookIds.map((webhookId) => ({
                webhookId,
              })),
            },
          },
        }),

      // Shared dashboard
      ...(publicStats && {
        dashboard: {
          create: {
            id: createId({ prefix: "dash_" }),
            projectId: link.projectId,
            userId: link.userId,
          },
        },
      }),
    },
    include: {
      ...includeTags,
      webhooks: webhookIds ? true : false,
    },
  });

  const uploadedImageUrl = `${R2_URL}/images/${response.id}`;

  waitUntil(
    Promise.allSettled([
      // cache link in Redis
      linkCache.set({
        ...response,
        ...(response.programId &&
          (await getPartnerAndDiscount({
            programId: response.programId,
            partnerId: response.partnerId,
          }))),
      }),

      // record link in Tinybird
      recordLink(response),
      // Upload image to R2 and update the link with the uploaded image URL when
      // proxy is enabled and image is set and not stored in R2
      ...(proxy && image && !isStored(image)
        ? [
            // upload image to R2
            storage.upload(`images/${response.id}`, image, {
              width: 1200,
              height: 630,
            }),
            // update the null image we set earlier to the uploaded image URL
            prisma.link.update({
              where: {
                id: response.id,
              },
              data: {
                image: uploadedImageUrl,
              },
            }),
          ]
        : []),
      // delete public links after 30 mins
      !response.userId &&
        qstash.publishJSON({
          url: `${APP_DOMAIN_WITH_NGROK}/api/cron/links/delete`,
          // delete after 30 mins
          delay: 30 * 60,
          body: {
            linkId: response.id,
          },
        }),
      // update links usage for workspace
      link.projectId &&
        updateLinksUsage({
          workspaceId: link.projectId,
          increment: 1,
        }),

      webhookIds &&
        propagateWebhookTriggerChanges({
          webhookIds,
        }),

      testVariants && testCompletedAt && scheduleABTestCompletion(response),
    ]),
  );

  return {
    ...transformLink(response),
    // optimistically set the image URL to the uploaded image URL
    image:
      proxy && image && !isStored(image) ? uploadedImageUrl : response.image,
  };
}
