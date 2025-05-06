import { recordMetatags } from "@/lib/upstash";
import { fetchWithTimeout, isValidUrl } from "@dub/utils";
import { waitUntil } from "@vercel/functions";
import he from "he";
import { parse } from "node-html-parser";

// Use a more browser-like User-Agent to avoid bot detection
const BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

export const getHtml = async (url: string) => {
  return await fetchWithTimeout(url, {
    headers: {
      "User-Agent": BROWSER_USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
  })
    .then((r) => r.text())
    .catch((error) => {
      console.error(`Error fetching HTML for ${url}:`, error);
      return null;
    });
};

export const getHeadChildNodes = (html) => {
  const ast = parse(html); // parse the html into AST format with node-html-parser
  const metaTags = ast.querySelectorAll("meta").map(({ attributes }) => {
    const property = attributes.property || attributes.name || attributes.href || attributes.itemprop;
    return {
      property,
      content: attributes.content,
    };
  });
  const title = ast.querySelector("title")?.innerText;
  const linkTags = ast.querySelectorAll("link").map(({ attributes }) => {
    const { rel, href } = attributes;
    return {
      rel,
      href,
    };
  });

  return { metaTags, title, linkTags, fullHtml: ast };
};

export const getRelativeUrl = (url: string, imageUrl: string) => {
  if (!imageUrl) {
    return null;
  }
  if (isValidUrl(imageUrl)) {
    return imageUrl;
  }
  // const { protocol, host } = new URL(url);
  // const baseURL = `${protocol}//${host}`;
  const baseURL = "https://thereflist.com";
  return new URL(imageUrl, baseURL).toString();
};

// Try to find product images in the HTML body for specific e-commerce sites
const tryFindProductImage = (ast, url) => {
  // For Revolve
  if (url.includes('revolve.com')) {
    // Try to find the primary product image
    const primaryImage = ast.querySelector("#js-primary-slideshow__image");
    if (primaryImage?.attributes?.src) {
      console.log(`Found Revolve primary image: ${primaryImage.attributes.src}`);
      return primaryImage.attributes.src;
    }
  }
  
  // Generic approach for any site - look for large images that might be product images
  const allImages = ast.querySelectorAll("img");
  // Filter to reasonable sized images that might be product images
  const productImages = allImages.filter(img => {
    const src = img.attributes.src;
    const width = parseInt(img.attributes.width || '0', 10);
    const height = parseInt(img.attributes.height || '0', 10);
    // Look for larger images that might be product images
    return src && (width > 400 || height > 400);
  });
  
  if (productImages.length > 0) {
    console.log(`Found potential product image: ${productImages[0].attributes.src}`);
    return productImages[0].attributes.src;
  }
  
  return null;
};

export const getMetaTags = async (url: string) => {
  console.log(`Fetching meta tags for URL: ${url}`);
  const html = await getHtml(url);
  if (!html) {
    console.error(`Failed to fetch HTML for ${url}`);
    return {
      title: url,
      description: "No description",
      image: null,
    };
  }
  
  console.log(`Processing HTML for ${url}, length: ${html.length}`);
  const { metaTags, title: titleTag, linkTags, fullHtml } = getHeadChildNodes(html);

  let object = {};

  for (let k in metaTags) {
    let { property, content } = metaTags[k];

    // !object[property] → (meaning we're taking the first instance of a metatag and ignoring the rest)
    property &&
      !object[property] &&
      (object[property] = content && he.decode(content));
  }

  for (let m in linkTags) {
    let { rel, href } = linkTags[m];

    // !object[rel] → (ditto the above)
    rel && !object[rel] && (object[rel] = href);
  }

  const title = object["og:title"] || object["twitter:title"] || titleTag;

  const description =
    object["description"] ||
    object["og:description"] ||
    object["twitter:description"];

  // Try to get image from meta tags first
  let image =
    object["og:image"] ||
    object["twitter:image"] ||
    object["image_src"] ||
    object["icon"] ||
    object["shortcut icon"];
  
  // If no image found in meta tags, try to find it in the HTML body for specific sites
  if (!image) {
    console.log(`No image found in meta tags for ${url}, trying HTML body`);
    image = tryFindProductImage(fullHtml, url);
  }

  // Log the image URL for debugging
  console.log(`Final image URL for ${url}: ${image || 'None found'}`);

  waitUntil(recordMetatags(url, title && description && image ? false : true));

  return {
    title: title || url,
    description: description || "No description",
    image: getRelativeUrl(url, image),
  };
};
