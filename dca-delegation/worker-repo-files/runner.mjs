#!/usr/bin/env node
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createPublicClient, createWalletClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

function requireEnv(name) {
  const v = process.env[name]
  if (!v) console.warn(`[worker] Missing ${name}`)
  return v
}

function readPlan() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const planPath = path.join(__dirname, 'plan.json')
  try {
    const raw = fs.readFileSync(planPath, 'utf-8')
    const plan = JSON.parse(raw)
    return { plan, planPath }
  } catch (e) {
    console.warn('[worker] Plan not found, creating default')
    const nowIso = new Date().toISOString()
    const plan = {
      mode: 'ai',
      intervalSeconds: 300,
      amounts: { mon: '0.05', usdc: '0' },
      tokens: { outToken: 'USDC' },
      slippage: { bps: 300 },
      nextRun: nowIso,
      lastRun: nowIso,
    }
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2))
    return { plan, planPath }
  }
}

function writePlan(planPath, plan) {
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2))
}

async function maybeExecute(plan, execFn) {
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const dueAt = (() => {
    const iso = String(plan.nextRun || plan.nextExecution || nowIso)
    const t = Date.parse(iso)
    return Number.isFinite(t) ? t : now
  })()

  if (now < dueAt) {
    console.log(`[worker] Not due yet. Next at ${new Date(dueAt).toISOString()}`)
    return false
  }

  if (String(plan.mode || '').toLowerCase() === 'off') {
    console.log('[worker] Mode is off. Skipping execution.')
    plan.lastRun = nowIso
    plan.nextRun = new Date(now + Math.max(10, Number(plan.intervalSeconds || 60)) * 1000).toISOString()
    return true
  }

  console.log('[worker] Executing DCA cycle…')

  const res = await execFn?.().catch((e) => ({ ok: false, error: e }))
  if (res && res.ok === false) {
    console.error('[worker] Execution error:', res.error)
  }

  plan.lastRun = nowIso
  plan.nextRun = new Date(now + Math.max(10, Number(plan.intervalSeconds || 60)) * 1000).toISOString()
  if (res?.txHash) plan.lastTxHash = res.txHash
  console.log(`[worker] Done. Next at ${plan.nextRun}`)
  return true
}

async function main() {
  const startedAt = new Date().toISOString()
  console.log(`[worker] DCA Worker start at ${startedAt}`)

  const rpc = requireEnv('VITE_RPC_URL')
  const bundler = requireEnv('VITE_ZERO_DEV_BUNDLER_RPC')
  const paymaster = requireEnv('VITE_ZERO_DEV_PAYMASTER_RPC')
  const delegatePk = requireEnv('VITE_DELEGATE_PRIVATE_KEY')
  const dryRun = (process.env.DRY_RUN || '0') === '1'
  const allowTestTx = (process.env.ALLOW_TEST_TX || '0') === '1'
  const useDTK = (process.env.USE_DTK || '0') === '1'

  const { plan, planPath } = readPlan()
  // Prepare execution function (DTK or EOA heartbeat / optional test tx)
  const execFn = async () => {
    if (!rpc || !delegatePk) {
      console.log('[worker] Missing RPC or PRIVATE_KEY, skipping on-chain action.')
      return { ok: true }
    }
    const account = privateKeyToAccount(delegatePk)
    const publicClient = createPublicClient({ transport: http(rpc) })
    const walletClient = createWalletClient({ account, transport: http(rpc) })

    // Sign a heartbeat message for visibility
    try {
      const sig = await walletClient.signMessage({ message: `DCA worker heartbeat @ ${new Date().toISOString()}` })
      console.log('[worker] Signed heartbeat:', sig.slice(0, 18) + '…')
    } catch (e) {
      console.warn('[worker] signMessage failed:', e?.message || e)
    }

    if (useDTK) {
      // Guarded DTK path. Keep logs minimal and safe when package/API differs.
      if (!bundler || !paymaster) {
        console.log('[worker] USE_DTK=1 but missing bundler/paymaster RPC. Skipping DTK path.')
      } else {
        try {
          // Lazy import to avoid startup error if package changes
          const dtk = await import('@metamask/delegation-toolkit').catch(() => null)
          if (!dtk) {
            console.log('[worker] Delegation Toolkit not available. Skipping DTK path.')
          } else {
            console.log('[worker] DTK stub: initialize client (no-op).')
            // TODO: initialize DTK client with bundler/paymaster and submit a no-op user operation.
            // For now, we exit early to avoid unintended on-chain operations.
            return { ok: true }
          }
        } catch (e) {
          console.warn('[worker] DTK init failed:', e?.message || e)
        }
      }
      // Fall through to EOA path as a heartbeat/micro-tx
    }

    if (dryRun) {
      console.log('[worker] DRY_RUN=1, skipping tx send.')
      return { ok: true }
    }

    if (!allowTestTx) {
      console.log('[worker] ALLOW_TEST_TX=0, not sending tx (set to 1 to enable).')
      return { ok: true }
    }

    // Send a tiny self-transfer to validate pipeline (testnets only)
    try {
      const txHash = await walletClient.sendTransaction({
        to: account.address,
        value: parseEther('0'),
      })
      console.log('[worker] Test tx sent:', txHash)
      return { ok: true, txHash }
    } catch (e) {
      console.error('[worker] sendTransaction failed:', e?.message || e)
      return { ok: false, error: e }
    }
  }

  const executed = await maybeExecute(plan, execFn)
  if (executed) writePlan(planPath, plan)
}

main().catch((e) => {
  console.error('[worker] Unhandled error:', e)
  process.exitCode = 1
})