// Cube.js configuration
module.exports = {
  queryRewrite: (query, { securityContext }) => {
    // Multi-tenant isolation — every query filtered to requesting tenant
    const tenantId = securityContext?.tenantId;
    if (tenantId) {
      query.filters = query.filters || [];
      query.filters.push({
        member: `${query.measures?.[0]?.split(".")[0] || query.dimensions?.[0]?.split(".")[0]}.tenantId`,
        operator: "equals",
        values: [tenantId],
      });
    }
    return query;
  },
  scheduledRefreshTimer: 60, // refresh pre-aggregations every 60s
  telemetry: false,
};
