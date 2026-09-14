const fs = require('fs');
const glob = fs.readdirSync('tests').filter(f => f.startsWith('verify_phase') && f.endsWith('.ts')).map(f => 'tests/' + f);

const replacement = `telemetry: {
  metrics: {
    revenueMTD: { value: 50000, unit: 'CURRENCY', source: 'stripe', freshness: 'REAL_TIME', lastUpdatedAt: new Date() },
    revenueLastMonth: { value: 0, unit: 'CURRENCY', source: 'NONE', freshness: 'UNAVAILABLE', lastUpdatedAt: null },
    transactionsMTD: { value: 0, unit: 'COUNT', source: 'NONE', freshness: 'UNAVAILABLE', lastUpdatedAt: null },
    newCustomersMTD: { value: 0, unit: 'COUNT', source: 'NONE', freshness: 'UNAVAILABLE', lastUpdatedAt: null },
    activeSubscriptions: { value: 0, unit: 'COUNT', source: 'NONE', freshness: 'UNAVAILABLE', lastUpdatedAt: null },
    totalLeads: { value: 100, unit: 'COUNT', source: 'crm', freshness: 'REAL_TIME', lastUpdatedAt: new Date() },
    activeLeadsCount: { value: 100, unit: 'COUNT', source: 'crm', freshness: 'REAL_TIME', lastUpdatedAt: new Date() },
    qualifiedLeads: { value: 50, unit: 'COUNT', source: 'crm', freshness: 'REAL_TIME', lastUpdatedAt: new Date() },
    unassignedHighPriorityLeads: { value: 10, unit: 'COUNT', source: 'crm', freshness: 'REAL_TIME', lastUpdatedAt: new Date() },
    pipelineValue: { value: 120000, unit: 'CURRENCY', source: 'crm', freshness: 'REAL_TIME', lastUpdatedAt: new Date() }
  },
  recentAnomalies: [],
  dataFreshness: []
}`;

for (const f of glob) {
    let text = fs.readFileSync(f, 'utf8');
    
    // The previous bad replacements caused nested blocks. Let's just find the identity block, and replace everything after it until goals:
    text = text.replace(/(identity:\s*\{[^}]+\},)\s*telemetry:.*?goals:/gs, '$1\n  ' + replacement + ',\n      goals:');

    fs.writeFileSync(f, text);
    console.log('Fixed ' + f);
}
