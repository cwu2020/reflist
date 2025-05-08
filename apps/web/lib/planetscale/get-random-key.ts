import { nanoid } from "@dub/utils";
import { checkIfKeyExists } from "./check-if-key-exists";

export async function getRandomKey({
  domain,
  prefix,
  long,
}: {
  domain: string;
  prefix?: string;
  long?: boolean;
}): Promise<string> {
  try {
    /* recursively get random key till it gets one that's available */
    let key = long ? nanoid(69) : nanoid();
    if (prefix) {
      key = `${prefix.replace(/^\/|\/$/g, "")}/${key}`;
    }

    console.log(`Generated random key: ${key} for domain: ${domain}`);

    try {
      const exists = await checkIfKeyExists({ domain, key });

      if (exists) {
        // by the off chance that key already exists
        console.log(`Key ${key} already exists, generating a new one`);
        return getRandomKey({ domain, prefix, long });
      } else {
        return key;
      }
    } catch (error) {
      console.error(`Error checking if key exists:`, error);
      // If there's an error checking if key exists, return the key anyway
      // It's better to attempt to create a link than to fail completely
      return key;
    }
  } catch (error) {
    console.error(`Error generating random key:`, error);
    // Fallback to a basic random key if nanoid fails for some reason
    const fallbackKey = Math.random().toString(36).substring(2, 10);
    console.log(`Using fallback key: ${fallbackKey}`);
    return fallbackKey;
  }
}
