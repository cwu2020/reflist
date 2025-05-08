import slugify from "@sindresorhus/slugify";
import {
  DUB_DOMAINS,
  SECOND_LEVEL_DOMAINS,
  SPECIAL_APEX_DOMAINS,
  ccTLDs,
} from "../constants";
import { isValidUrl } from "./urls";

export const generateDomainFromName = (name: string) => {
  const normalizedName = slugify(name, { separator: "" });
  if (normalizedName.length < 3) {
    return "";
  }
  if (ccTLDs.has(normalizedName.slice(-2))) {
    return `${normalizedName.slice(0, -2)}.${normalizedName.slice(-2)}`;
  }
  // remove vowels
  const devowel = normalizedName.replace(/[aeiou]/g, "");
  if (devowel.length >= 3 && ccTLDs.has(devowel.slice(-2))) {
    return `${devowel.slice(0, -2)}.${devowel.slice(-2)}`;
  }

  const shortestString = [normalizedName, devowel].reduce((a, b) =>
    a.length < b.length ? a : b,
  );

  return `${shortestString}.link`;
};

// courtesy of ChatGPT: https://sharegpt.com/c/pUYXtRs
export const validDomainRegex = new RegExp(
  /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
);

export const validSlugRegex = new RegExp(/^[a-zA-Z0-9\-]+$/);

export const getSubdomain = (name: string, apexName: string) => {
  if (name === apexName) return null;
  return name.slice(0, name.length - apexName.length - 1);
};

/**
 * Get the apex domain from a URL
 * Enhanced to handle extremely long URLs, malformed URLs, and various edge cases
 * 
 * @param url The URL to extract the apex domain from
 * @returns The apex domain or empty string if extraction fails
 */
export const getApexDomain = (url: string) => {
  if (!url) return "";
  
  // For extremely long URLs, only process the first part to avoid performance issues
  const maxProcessLength = 2000; // Safety limit for URL processing
  const urlToProcess = url.length > maxProcessLength 
    ? url.substring(0, maxProcessLength) 
    : url;
  
  let domain;
  try {
    // First try with standard URL parsing
    // Replace any custom scheme (e.g. notion://) with https://
    domain = new URL(urlToProcess.replace(/^[a-zA-Z]+:\/\//, "https://")).hostname;
  } catch (e) {
    // If URL parsing fails, try to extract the domain with regex
    try {
      // Look for something that looks like a domain in the URL
      const domainMatch = urlToProcess.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z0-9-.]+)/i);
      if (domainMatch && domainMatch[1]) {
        domain = domainMatch[1];
      } else {
        // Try to handle common URL formats without protocol
        if (!urlToProcess.includes('://') && !urlToProcess.startsWith('www.')) {
          const domainCandidate = urlToProcess.split('/')[0];
          if (domainCandidate.includes('.')) {
            domain = domainCandidate;
          }
        }
      }
      
      // If we still don't have a domain, return empty string
      if (!domain) {
        return "";
      }
    } catch (regexError) {
      return "";
    }
  }
  
  // Special case for YouTube shortened URLs
  if (domain === "youtu.be") return "youtube.com";

  // Process the domain to extract the apex domain
  const parts = domain.split(".");
  
  // Handle IP addresses
  if (parts.length === 4 && parts.every(part => !isNaN(parseInt(part)))) {
    return domain; // This is an IP address
  }
  
  if (parts.length > 2) {
    if (
      // if this is a second-level TLD (e.g. co.uk, .com.ua, .org.tt), we need to return the last 3 parts
      (SECOND_LEVEL_DOMAINS.has(parts[parts.length - 2]) &&
        ccTLDs.has(parts[parts.length - 1])) ||
      // if it's a special subdomain for website builders (e.g. weathergpt.vercel.app/)
      SPECIAL_APEX_DOMAINS.has(parts.slice(-2).join("."))
    ) {
      return parts.slice(-3).join(".");
    }
    // otherwise, it's a subdomain (e.g. dub.vercel.app), so we return the last 2 parts
    return parts.slice(-2).join(".");
  }
  // if it's a normal domain (e.g. dub.co), we return the domain
  return domain;
};

/**
 * Get the domain without www prefix
 * Works with URLs with or without protocol
 * 
 * @param url The URL to process
 * @returns The domain without www or null if extraction fails
 */
export const getDomainWithoutWWW = (url: string) => {
  if (!url) return null;
  
  // For extremely long URLs, only process the first part
  const maxProcessLength = 2000;
  const urlToProcess = url.length > maxProcessLength 
    ? url.substring(0, maxProcessLength) 
    : url;
  
  if (isValidUrl(urlToProcess)) {
    return new URL(urlToProcess).hostname.replace(/^www\./, "");
  }
  
  try {
    // Handle URLs without protocol
    if (urlToProcess.includes(".") && !urlToProcess.includes(" ")) {
      // Check first if it's already a domain without protocol
      if (!urlToProcess.includes("/")) {
        return urlToProcess.replace(/^www\./, "");
      }
      return new URL(`https://${urlToProcess}`).hostname.replace(/^www\./, "");
    }
  } catch (e) {
    // Try a more lenient approach for edge cases
    try {
      const domainMatch = urlToProcess.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z0-9-.]+)/i);
      if (domainMatch && domainMatch[1]) {
        return domainMatch[1].replace(/^www\./, "");
      }
    } catch (regexError) {
      // Ignore regex errors
    }
    return null;
  }
  
  return null;
};

export const isDubDomain = (domain: string) => {
  return DUB_DOMAINS.some((d) => d.slug === domain);
};
