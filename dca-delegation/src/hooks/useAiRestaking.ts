import { useState, useEffect } from 'react'

/**
 * Hook centralisé pour gérer l'état de l'AI Restaking
 * Permet de partager cet état entre DcaControl et les composants de bulles IA
 */
export function useAiRestaking() {
  const [restakeAi, setRestakeAiState] = useState<boolean>(() => {
    try {
      return localStorage.getItem("restake-ai") === "1";
    } catch {
      return false;
    }
  });

  // Synchroniser avec localStorage
  useEffect(() => {
    try {
      localStorage.setItem("restake-ai", restakeAi ? "1" : "0");
    } catch {
      // Ignore localStorage errors
    }
  }, [restakeAi]);

  const setRestakeAi = (enabled: boolean) => {
    setRestakeAiState(enabled);
  };

  return {
    restakeAi,
    setRestakeAi,
  };
}