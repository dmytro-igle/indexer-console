import { z } from "zod";
import { getDomainsByIds, type DomainRow } from "@/lib/db/domains";

export const bulkBodySchema = z.object({
  domainIds: z.array(z.number().int().positive()).optional(),
});

export async function resolveTargetDomains(request: Request): Promise<DomainRow[]> {
  const json = await request.json().catch(() => ({}));
  const parsed = bulkBodySchema.safeParse(json ?? {});
  const domainIds = parsed.success ? parsed.data.domainIds : undefined;
  return getDomainsByIds(domainIds);
}
