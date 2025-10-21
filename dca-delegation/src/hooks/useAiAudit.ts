import { useState, useCallback } from 'react'
import { aiAuditor, type AuditReport, type AuditContext } from '../lib/aiAudit'
import type { AiDecision } from '../lib/aiAgent'
import type { EnvioMetrics } from './useEnvioMetrics'
import { getTargetTokens } from '../lib/tokens'

export function useAiAudit() {
  const [auditHistory, setAuditHistory] = useState<AuditReport[]>(aiAuditor.getAuditHistory())
  const [isAuditing, setIsAuditing] = useState(false)

  const auditDecision = useCallback(async (
    decision: AiDecision,
    balances: Record<string, string>,
    metrics: EnvioMetrics,
    portfolioValueMon: number,
    delegationExpired: boolean,
    maxDailySpend: number = 1.0, // Default 1 MON per day
    maxSlippageBps: number = 500 // Default 5% slippage
  ): Promise<AuditReport> => {
    setIsAuditing(true)
    const debugAi = (((import.meta as any).env?.VITE_DEBUG_AI ?? (import.meta as any).env?.VITE_DEBUG_ENVIO ?? 'true') === 'true')
    
    try {
      const context: AuditContext = {
        balances,
        metrics,
        portfolioValueMon,
        delegationExpired,
        maxDailySpend,
        allowedTokens: [...getTargetTokens().map(t => t.symbol), 'USDC', 'WMON'], // Inclure USDC et WMON
        maxSlippageBps
      }

      if (debugAi) {
        console.info('[ai] auditing', {
          decisionId: decision.id,
          action: decision.action?.type,
          txToday: context.metrics?.txToday,
          whales: context.metrics?.whales24h?.length,
          feesTodayMon: context.metrics?.feesTodayMon,
          lastUpdatedISO: context.metrics?.lastUpdated ? new Date(context.metrics.lastUpdated).toISOString() : null
        })
      }

      const report = aiAuditor.audit(decision, context)
      setAuditHistory(aiAuditor.getAuditHistory())
      if (debugAi) {
        console.info('[ai] audit-result', {
          decisionId: decision.id,
          overallStatus: report.overallStatus,
          riskScore: report.riskScore,
          marketRule: report.results.find(r => r.ruleId === 'market-conditions')?.message
        })
      }
      
      return report
    } finally {
      setIsAuditing(false)
    }
  }, [])

  const getAuditStats = useCallback(() => {
    return aiAuditor.getAuditStats()
  }, [auditHistory])

  const exportForSwarm = useCallback((decision: AiDecision, context: Omit<AuditContext, 'allowedTokens'>) => {
    const fullContext: AuditContext = {
      ...context,
      allowedTokens: [...getTargetTokens().map(t => t.symbol), 'USDC', 'WMON'] // Inclure USDC et WMON
    }
    return aiAuditor.exportDecisionContext(decision, fullContext)
  }, [])

  return {
    auditHistory,
    isAuditing,
    auditDecision,
    getAuditStats,
    exportForSwarm
  }
}
