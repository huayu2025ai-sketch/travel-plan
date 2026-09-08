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
    if (!Array.isArray(parsedConversation)) return [];

    // 归一化历史版本遗留的超长内容，避免存量用户之后每次优化请求都被服务端拒绝。
    return parsedConversation
      .filter((item) => item && typeof item === 'object' && typeof item.content === 'string')
      .map((item) => ({
        role: typeof item.role === 'string' && item.role ? item.role : 'user',
        content: item.content.slice(0, 800),
      }))
      .slice(-8);
  } catch {
    return [];
  }
}
