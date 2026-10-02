function configured(...names) {
  return names.every((name) => Boolean(process.env[name]));
}

export function integrationStatus() {
  return {
    outlook: {
      configured: configured('STARTUP_OUTLOOK_ENDPOINT', 'STARTUP_OUTLOOK_TOKEN'),
      mode: 'approval-required'
    },
    sharepoint: {
      configured: configured('STARTUP_SHAREPOINT_ENDPOINT', 'STARTUP_SHAREPOINT_TOKEN'),
      visibleToManagers: false
    }
  };
}

export function executionPlan(skill, input) {
  const status = integrationStatus();
  if (skill.executor === 'outlook') {
    return {
      mode: status.outlook.configured ? 'review' : 'preview',
      status: 'awaiting-review',
      message: status.outlook.configured
        ? 'Kampania jest gotowa do zatwierdzenia.'
        : 'Przygotowano podgląd. Outlook nie jest jeszcze podłączony; niczego nie wysłano.',
      summary: `${input.recipients?.length || 0} odbiorców`
    };
  }
  return {
    mode: 'queued',
    status: 'queued',
    message: 'Zadanie zapisano i oczekuje na wykonawcę skilla.',
    summary: skill.title
  };
}
