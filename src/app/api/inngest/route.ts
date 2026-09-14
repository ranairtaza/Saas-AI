import { serve } from "inngest/next";
import { inngest } from "../../../lib/inngest/client";
import { processDiscoveryJob } from "../../../lib/inngest/functions/discovery";
import { cleanupDiscoveryResults } from "../../../lib/inngest/functions/retention";
import { dailyBusinessIntelligence } from "../../../lib/inngest/functions/intelligence";
import { syncIntegration, scheduleSyncIntegrations } from "../../../lib/inngest/functions/integrations";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processDiscoveryJob,
    cleanupDiscoveryResults,
    dailyBusinessIntelligence,
    syncIntegration,
    scheduleSyncIntegrations,
  ],
});
