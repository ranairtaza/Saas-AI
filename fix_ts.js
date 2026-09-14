const { Project } = require("ts-morph");

async function fix() {
  const project = new Project();
  project.addSourceFilesAtPaths([
    "src/ai/executive/health-evaluator.ts",
    "src/ai/executive/observation-engine.ts",
    "src/ai/executive/outcomes/snapshot-service.ts",
    "src/ai/executive/reasoning-engine.ts",
    "src/ai/executive/strategy/dependency-engine.ts",
    "src/ai/executive/strategy/scenario-engine.ts",
    "src/ai/executive/strategy/strategy-engine.ts",
    "src/ai/executive/forecasting/forecast-engine.ts"
  ]);

  for (const sf of project.getSourceFiles()) {
    // Because I used regex replace, I'll just undo my regex by finding the bad strings.
    let text = sf.getFullText();
    text = text.replace(/\(typeof context\.telemetry\.metrics\.revenueMTD\?\.value === 'number' && context\.telemetry\.metrics\.revenueMTD\?\.value > 0\)/g, "context.telemetry.metrics.revenueMTD?.value > 0");
    text = text.replace(/\(context\.telemetry\.metrics\.revenueMTD\?\.value \|\| 0\)\.toLocaleString\(\)/g, "context.telemetry.metrics.revenueMTD?.value.toLocaleString()");
    text = text.replace(/\(typeof context\.telemetry\.metrics\.qualifiedLeads\?\.value === 'number' && context\.telemetry\.metrics\.qualifiedLeads\?\.value > 5\)/g, "context.telemetry.metrics.qualifiedLeads?.value > 5");
    text = text.replace(/\(\(context\.telemetry\.metrics\.qualifiedLeads\?\.value \|\| 0\) \|\| 0\)/g, "context.telemetry.metrics.qualifiedLeads?.value");
    text = text.replace(/\(typeof unassigned === 'number' && unassigned > 0\)/g, "unassigned > 0");
    text = text.replace(/\(\(unassigned \|\| 0\) \|\| 0\) \* 15/g, "unassigned * 15");
    
    // Reverse the simple replacements
    text = text.replace(/\(context\.telemetry\.metrics\.revenueMTD\?\.value \|\| 0\)/g, "context.telemetry.metrics.revenueMTD?.value");
    text = text.replace(/\(context\.telemetry\.metrics\.pipelineValue\?\.value \|\| 0\)/g, "context.telemetry.metrics.pipelineValue?.value");
    text = text.replace(/\(unassignedCount \|\| 0\)/g, "unassignedCount");
    text = text.replace(/\(context\.telemetry\.metrics\.unassignedHighPriorityLeads\?\.value \|\| 0\)/g, "context.telemetry.metrics.unassignedHighPriorityLeads?.value");
    text = text.replace(/\(telemetry\.metrics\.revenueMTD\?\.value \|\| 0\)/g, "telemetry.metrics.revenueMTD?.value");
    text = text.replace(/\(telemetry\.metrics\.pipelineValue\?\.value \|\| 0\)/g, "telemetry.metrics.pipelineValue?.value");
    text = text.replace(/\(telemetry\.metrics\.qualifiedLeads\?\.value \|\| 0\)/g, "telemetry.metrics.qualifiedLeads?.value");
    text = text.replace(/\(telemetry\.metrics\.unassignedHighPriorityLeads\?\.value \|\| 0\)/g, "telemetry.metrics.unassignedHighPriorityLeads?.value");
    text = text.replace(/\(highValLeads \|\| 0\)/g, "highValLeads");
    
    // Now apply safe TS checking for those missing `?? 0`
    // We can use a smarter replacement.
    // E.g., `context.telemetry.metrics.revenueMTD?.value > 0` => `(context.telemetry.metrics.revenueMTD?.value ?? -1) > 0`
    text = text.replace(/context\.telemetry\.metrics\.revenueMTD\?\.value > 0/g, "(context.telemetry.metrics.revenueMTD?.value ?? -1) > 0");
    
    // `context.telemetry.metrics.revenueMTD?.value.toLocaleString()` => `(context.telemetry.metrics.revenueMTD?.value ?? 0).toLocaleString()`
    text = text.replace(/context\.telemetry\.metrics\.revenueMTD\?\.value\.toLocaleString\(\)/g, "(context.telemetry.metrics.revenueMTD?.value ?? 0).toLocaleString()");

    // `context.telemetry.metrics.qualifiedLeads?.value > 5` => `(context.telemetry.metrics.qualifiedLeads?.value ?? 0) > 5`
    text = text.replace(/context\.telemetry\.metrics\.qualifiedLeads\?\.value > 5/g, "(context.telemetry.metrics.qualifiedLeads?.value ?? 0) > 5");
    
    // `unassigned > 0` where unassigned is `context.telemetry.metrics.unassignedHighPriorityLeads?.value`
    text = text.replace(/unassigned > 0/g, "(unassigned ?? 0) > 0");
    
    // `unassigned * 15`
    text = text.replace(/unassigned \* 15/g, "(unassigned ?? 0) * 15");

    // any remaining missing `.value` need `?? 0` except for those we just did
    text = text.replace(/context\.telemetry\.metrics\.revenueMTD\?\.value(?! \?\?)/g, "(context.telemetry.metrics.revenueMTD?.value ?? 0)");
    text = text.replace(/context\.telemetry\.metrics\.pipelineValue\?\.value(?! \?\?)/g, "(context.telemetry.metrics.pipelineValue?.value ?? 0)");
    text = text.replace(/context\.telemetry\.metrics\.unassignedHighPriorityLeads\?\.value(?! \?\?)/g, "(context.telemetry.metrics.unassignedHighPriorityLeads?.value ?? 0)");
    
    text = text.replace(/telemetry\.metrics\.revenueMTD\?\.value(?! \?\?)/g, "(telemetry.metrics.revenueMTD?.value ?? 0)");
    text = text.replace(/telemetry\.metrics\.pipelineValue\?\.value(?! \?\?)/g, "(telemetry.metrics.pipelineValue?.value ?? 0)");
    text = text.replace(/telemetry\.metrics\.qualifiedLeads\?\.value(?! \?\?)/g, "(telemetry.metrics.qualifiedLeads?.value ?? 0)");
    text = text.replace(/telemetry\.metrics\.unassignedHighPriorityLeads\?\.value(?! \?\?)/g, "(telemetry.metrics.unassignedHighPriorityLeads?.value ?? 0)");

    // `unassignedCount`
    text = text.replace(/\bunassignedCount\b(?! \?\?)(?!:)(?!=)/g, "(unassignedCount ?? 0)");
    
    // `highValLeads`
    text = text.replace(/\bhighValLeads\b(?! \?\?)(?!:)(?!=)/g, "(highValLeads ?? 0)");
    
    sf.replaceWithText(text);
  }
  
  await project.save();
}

fix();
