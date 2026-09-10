import { headers } from "next/headers";
import { readOnlyDeveloperHeader } from "@/lib/readOnlyDeveloper";

export async function assertDeveloperWriteAllowed() {
  let requestHeaders;
  try {
    requestHeaders = await headers();
  } catch (error) {
    // CLI jobs have no HTTP identity; HTTP reads must retain the middleware marker.
    if (error instanceof Error && error.message.includes("outside a request scope")) return;
    throw error;
  }
  if (requestHeaders.get(readOnlyDeveloperHeader) === "1") {
    throw new Error("READ_ONLY_DEVELOPER: database changes are not allowed.");
  }
}
