import "server-only";
import { createResourceStorage } from "@/lib/clubResources/storage";
export const { createResourceUploadUrl, inspectResourceFile, createResourceReadUrl, deleteResourceFile } = createResourceStorage("ecc-resource-library");
