import { z } from "zod";
import { getDomainsByIds, type DomainRow } from "@/lib/db/domains";

export const bulkBodySchema = z.object({
  domainIds: z.array(z.number().int().positive()).optional(),
  urlIds: z.array(z.number().int().positive()).optional(),
});

export type BulkRequestBody = z.infer<typeof bulkBodySchema>;

export async function parseBulkRequest(request: Request): Promise<BulkRequestBody> {
  const json = await request.json().catch(() => ({}));
  const parsed = bulkBodySchema.safeParse(json ?? {});
  return parsed.success ? parsed.data : {};
}

export async function resolveTargetDomains(request: Request): Promise<DomainRow[]> {
  const body = await parseBulkRequest(request);
  return getDomainsByIds(body.domainIds);
}
