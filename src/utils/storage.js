const storageKey = 'travel-plan-board-v1';
const conversationStorageKey = 'travel-plan-conversation-v1';

export function loadStoredPlan(initialPlan, normalizePlan) {
  if (typeof window === 'undefined') return initialPlan;

  try {
    const storedPlan = window.localStorage.getItem(storageKey);
    return storedPlan ? normalizePlan(JSON.parse(storedPlan)) : initialPlan;
  } catch {
    return initialPlan;
  }
}

export function loadStoredConversation() {
  if (typeof window === 'undefined') return [];

  try {
    const storedConversation = window.localStorage.getItem(conversationStorageKey);
    const parsedConversation = storedConversation ? JSON.parse(storedConversation) : [];
    return Array.isArray(parsedConversation) ? parsedConversation.slice(-8) : [];
  } catch {
    return [];
  }
}
