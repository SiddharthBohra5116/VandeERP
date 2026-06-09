/**
 * Utility helper to compile Lead Source Quality Analytics.
 * Computes: total inquiries, conversions, conversion rates, and average conversion times.
 *
 * @param {Array} leads - List of Mongoose Lead documents
 * @returns {Object} Map of source category metadata statistics
 */
function computeSourceStats(leads) {
  const sourceStatsMap = {};
  const sourcesList = ['Walk-in', 'Website', 'Referral', 'Social Media', 'Advertisement', 'WhatsApp', 'Other'];

  // Initialize map
  sourcesList.forEach(src => {
    sourceStatsMap[src] = { total: 0, converted: 0, convRate: 0, avgDays: 0, totalConvTimeMs: 0 };
  });

  // Populate data
  leads.forEach(l => {
    const src = l.source || 'Other';
    if (!sourceStatsMap[src]) {
      sourceStatsMap[src] = { total: 0, converted: 0, convRate: 0, avgDays: 0, totalConvTimeMs: 0 };
    }

    sourceStatsMap[src].total++;
    if (l.status === 'converted') {
      sourceStatsMap[src].converted++;
      const convDate = l.convertedAt || l.updatedAt;
      if (l.createdAt && convDate) {
        const diffMs = new Date(convDate) - new Date(l.createdAt);
        sourceStatsMap[src].totalConvTimeMs += Math.max(0, diffMs);
      }
    }
  });

  // Calculate rates and averages
  Object.keys(sourceStatsMap).forEach(src => {
    const s = sourceStatsMap[src];
    s.convRate = s.total > 0 ? Math.round((s.converted / s.total) * 100) : 0;
    s.avgDays = s.converted > 0 ? Math.round((s.totalConvTimeMs / (1000 * 60 * 60 * 24)) / s.converted) : 0;
  });

  return sourceStatsMap;
}

module.exports = {
  computeSourceStats
};
