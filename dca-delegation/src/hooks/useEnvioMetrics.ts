import { useEffect, useMemo, useState } from 'react'
import { queryEnvio, getEnvioUrl } from '../lib/envioClient'
import { TOKENS, USDC } from '../lib/tokens'
import { useTokenMetrics } from './useTokenMetrics'

function startOfDayEpoch(): number {
  // Use UTC start of day to avoid local timezone mismatches with indexer timestamps
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

function toMon(wei: bigint): number {
  return Number(wei) / 1e18
}

export interface EnvioMetrics {
  txToday: number
  feesTodayMon: number
  whales24h: Array<{ token: string; from: string; to: string; value: string; ts: number; tx: string }>
  lastUpdated?: number
}

export function useEnvioMetrics(saAddress?: string) {
  const [metrics, setMetrics] = useState<EnvioMetrics>({ txToday: 0, feesTodayMon: 0, whales24h: [], lastUpdated: undefined })
  // Start in loading=true to avoid consumers reading default zeros before first fetch completes
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const envioEnabled = ((import.meta.env.VITE_ENVIO_ENABLED ?? 'true') === 'true')
  const debugEnvio = (((import.meta as any).env?.VITE_DEBUG_ENVIO ?? 'true') === 'true')
  // Thresholds from env (consistent with useWhaleTransfers/useWhaleAlerts)
  const whaleUsdThreshold = Number((import.meta as any).env?.VITE_WHALE_USDC_THRESHOLD ?? (import.meta as any).env?.VITE_WHALE_USD_THRESHOLD ?? 5000)
  const minUsd = Number((import.meta as any).env?.VITE_WHALE_MIN_USD ?? 100)

  const tracked = useMemo(() => Object.values(TOKENS).map(t => (t.address as string).toLowerCase()), [])
  const since = useMemo(() => startOfDayEpoch(), [])
  const sinceWhale = useMemo(() => Math.floor(Date.now() / 1000) - 7 * 86400, [])
  const { tokenMetrics } = useTokenMetrics()
  const priceBySymbol = useMemo(() => {
    const m: Record<string, number> = {}
    for (const tm of tokenMetrics) {
      if (Number.isFinite(tm.price) && tm.price > 0) m[tm.token] = tm.price
    }
    return m
  }, [tokenMetrics])

  useEffect(() => {
    // Even without saAddress we still compute global market activity and whales
    if (!envioEnabled) {
      // Disable Envio polling entirely to avoid CORS/network noise
      setLoading(false)
      setError(null)
      setMetrics({ txToday: 0, feesTodayMon: 0, whales24h: [], lastUpdated: Date.now() })
      return
    }

    let abort = new AbortController()
    async function run() {
      setLoading(true)
      setError(null)
      try {
        // 1) Global market activity today from SwapEvent + Kuru_Trade + TokenTransfer (unique tx hashes)
        const dayActivity = await queryEnvio<{ SwapEvent: Array<any>; Kuru_Trade: Array<any>; TokenTransfer: Array<any> }>({
          query: `query DayActivity($since:Int!,$tokens:[String!]){
            SwapEvent(where:{ blockTimestamp: { _gt: $since } }, order_by:{ blockTimestamp: desc }, limit: 5000){ transactionHash }
            Kuru_Trade(where:{ blockTimestamp: { _gt: $since } }, order_by:{ blockTimestamp: desc }, limit: 5000){ transactionHash }
            TokenTransfer(where:{ tokenAddress: { _in: $tokens }, blockTimestamp: { _gt: $since } }, order_by:{ blockTimestamp: desc }, limit: 5000){ transactionHash }
          }`,
          variables: { since, tokens: tracked }
        }, abort.signal)
        const uniq = new Set<string>()
        for (const e of (dayActivity?.SwapEvent ?? [])) if (e?.transactionHash) uniq.add(String(e.transactionHash))
        for (const e of (dayActivity?.Kuru_Trade ?? [])) if (e?.transactionHash) uniq.add(String(e.transactionHash))
        for (const e of (dayActivity?.TokenTransfer ?? [])) if (e?.transactionHash) uniq.add(String(e.transactionHash))
        const txCount = uniq.size

        // 2) Fees Today from SA-specific transfers (optional if saAddress provided)
        let feeWei = 0n
        if (saAddress) {
          const from = (saAddress as string).toLowerCase()
          const transfers = await queryEnvio<{ TokenTransfer: Array<any> }>({
            query: `query T($from:String!,$since:Int!){
              TokenTransfer(
                where: { from: { _eq: $from }, blockTimestamp: { _gt: $since } }
                order_by: { blockTimestamp: desc }
                limit: 1000
              ){
                tokenAddress from to value blockTimestamp transactionHash gasUsed gasPrice
              }
            }`,
            variables: { from, since }
          }, abort.signal)
          const uniqTx = new Map<string, { gasUsed: bigint; gasPrice: bigint }>()
          for (const t of transfers.TokenTransfer) {
            if (!tracked.includes(String(t.tokenAddress).toLowerCase())) continue
            const txh: string = t.transactionHash
            if (!uniqTx.has(txh)) {
              uniqTx.set(txh, { gasUsed: BigInt(t.gasUsed ?? 0), gasPrice: BigInt(t.gasPrice ?? 0) })
            }
          }
          uniqTx.forEach(({ gasUsed, gasPrice }) => { feeWei += gasUsed * gasPrice })
        }

  const whales: Array<{ token: string; from: string; to: string; value: string; ts: number; tx: string }> = []
        const tokenList = Object.values(TOKENS)
          .map(t => (t.address as string).toLowerCase())
        const wdata = await queryEnvio<{ TokenTransfer: Array<any> }>({
          query: `query W($tokens:[String!],$since:Int!){
            TokenTransfer(
              where: { tokenAddress: { _in: $tokens }, blockTimestamp: { _gt: $since } }
              order_by: { blockTimestamp: desc }
              limit: 200
            ){
              tokenAddress from to value blockTimestamp transactionHash
            }
          }`,
          variables: { tokens: tokenList, since: sinceWhale }
        }, abort.signal)
        for (const t of wdata.TokenTransfer) {
          const addr = String(t.tokenAddress).toLowerCase()
          const tok = Object.values(TOKENS).find(x => (x.address as string).toLowerCase() === addr)
          if (!tok) continue
          const decimals = tok.decimals || 18
          const amount = Number(String(t.value)) / Math.pow(10, decimals)
          if (!Number.isFinite(amount)) continue
          let eqUSDC = 0
          if ((tok.address as string).toLowerCase() === USDC.toLowerCase()) eqUSDC = amount
          else {
            const price = priceBySymbol[tok.symbol]
            if (!Number.isFinite(price) || price <= 0) continue
            eqUSDC = amount * price
          }
          if (eqUSDC < minUsd) continue
          if (eqUSDC >= whaleUsdThreshold) {
            whales.push({ token: t.tokenAddress, from: t.from, to: t.to, value: String(t.value), ts: Number(t.blockTimestamp), tx: t.transactionHash })
          }
        }

        const nowTs = Date.now()
        setMetrics({ txToday: txCount, feesTodayMon: toMon(feeWei), whales24h: whales, lastUpdated: nowTs })
        if (debugEnvio) {
          const endpoint = getEnvioUrl()
          console.info('[envio] metrics-ready', {
            endpoint,
            txToday: txCount,
            whales: whales.length,
            feesTodayMon: toMon(feeWei),
            sinceUTC: new Date(startOfDayEpoch()*1000).toISOString().slice(0,19)+'Z',
            lastUpdatedISO: new Date(nowTs).toISOString()
          })
        }
      } catch (e: any) {
        if (abort.signal.aborted) return
        setError(e.message || String(e))
      } finally {
        if (!abort.signal.aborted) setLoading(false)
      }
    }

    run()
    const pollMs = Number((import.meta as any).env?.VITE_ENVIO_POLL_MS ?? 15000)
    const id = setInterval(run, Math.max(3000, pollMs))
    return () => { abort.abort(); clearInterval(id) }
  }, [saAddress, tracked, since, sinceWhale, envioEnabled])

  return { metrics, loading, error }
}
