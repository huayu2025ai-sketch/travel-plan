export function preserveConcurrentPlanEdits(basePlan, currentPlan, generatedPlan) {
  const result = { ...generatedPlan };
  if (JSON.stringify(currentPlan.itinerary) !== JSON.stringify(basePlan.itinerary)) {
    result.itinerary = currentPlan.itinerary;
    result.weather = currentPlan.weather || {};
  }
  for (const field of ['destination', 'start_date', 'recommended_transport']) {
    if (currentPlan[field] !== basePlan[field]) result[field] = currentPlan[field];
  }
  if (currentPlan.start_date !== basePlan.start_date || currentPlan.destination !== basePlan.destination) {
    result.weather = {};
    result.weather_context = null;
  }
  if (JSON.stringify(currentPlan.packing_items || []) !== JSON.stringify(basePlan.packing_items || [])) {
    result.packing_items = currentPlan.packing_items;
  }
  return result;
}
