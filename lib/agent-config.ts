export interface AgentMemorySection {
  id: string;
  label: string;
}

export interface ResolvedAgentMemoryConfig {
  maxItems: number;
  maxChars: number;
  sections: AgentMemorySection[];
}

export interface ResolvedAgentConfig {
  systemPrompt: string | null;
  memory: ResolvedAgentMemoryConfig | null;
}

// À terme, lire l'Oracle via enterprise_id ; seule cette fonction changera.
export function resolveAgentConfig(businessRow: any): ResolvedAgentConfig {
  const agentConfig = businessRow?.config?.oracle?.agent;

  // 1. System Prompt
  let systemPrompt: string | null = null;
  const rawPrompt = agentConfig?.system_prompt;
  if (
    typeof rawPrompt === 'string' &&
    rawPrompt.trim().length > 0 &&
    rawPrompt.length <= 8000
  ) {
    systemPrompt = rawPrompt;
  }

  // 2. Memory Configuration (AUCUNE valeur par défaut codée en dur pour les limites)
  let memory: ResolvedAgentMemoryConfig | null = null;
  const rawMemory = agentConfig?.memory;

  if (rawMemory && typeof rawMemory === 'object') {
    const rawMaxItems = rawMemory.max_items ?? rawMemory.maxItems;
    const rawMaxChars = rawMemory.max_chars ?? rawMemory.maxChars;
    const rawSections = rawMemory.sections;

    const maxItems =
      typeof rawMaxItems === 'number' && Number.isFinite(rawMaxItems) && rawMaxItems > 0
        ? Math.floor(rawMaxItems)
        : null;

    const maxChars =
      typeof rawMaxChars === 'number' && Number.isFinite(rawMaxChars) && rawMaxChars > 0
        ? Math.floor(rawMaxChars)
        : null;

    const isValidSections =
      Array.isArray(rawSections) &&
      rawSections.length > 0 &&
      rawSections.every(
        (s: any) =>
          s &&
          typeof s === 'object' &&
          typeof s.id === 'string' &&
          s.id.trim().length > 0 &&
          typeof s.label === 'string' &&
          s.label.trim().length > 0
      );

    if (maxItems !== null && maxChars !== null && isValidSections) {
      memory = {
        maxItems,
        maxChars,
        sections: rawSections.map((s: any) => ({
          id: String(s.id).trim(),
          label: String(s.label).trim(),
        })),
      };
    }
  }

  return {
    systemPrompt,
    memory,
  };
}

export function isSensitiveMemoryText(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();

  if (
    lower.includes('mot de passe') ||
    lower.includes('password') ||
    lower.includes('code pin') ||
    lower.includes('iban')
  ) {
    return true;
  }

  // Suite de 13 à 19 chiffres (numéro de carte bancaire, avec ou sans séparateurs d'espaces/tirets)
  if (/\d{13,19}/.test(text) || /\b(?:\d[ -]?){13,19}\b/.test(text)) {
    return true;
  }

  return false;
}
