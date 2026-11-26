import { ok, route } from "@/lib/server/http";
import { listSubjects } from "@/lib/server/repo";

export const GET = route(async () => ok(await listSubjects()));
