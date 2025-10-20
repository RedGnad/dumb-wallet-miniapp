import React, { useEffect, useMemo, useRef, Suspense, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, ContactShadows, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

function FitToUnit({ children, variant }: { children: React.ReactNode, variant?: string }) {
  const group = useRef<THREE.Group>(null!)
  useEffect(() => {
    if (!group.current) return
    const box = new THREE.Box3().setFromObject(group.current)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxSide = Math.max(size.x, size.y, size.z) || 1
    // Ajuster les tailles par variant
    let baseScale = 1.5 // défaut
    if (variant === 'conservative') baseScale = 1.6 // ENCORE plus grande pour conservative
    else if (variant === 'balanced') baseScale = 1.8 // Un peu plus grand
    const scale = baseScale / maxSide
    group.current.scale.setScalar(scale)
    const center = new THREE.Vector3()
    box.getCenter(center)
    group.current.position.set(-center.x * scale, -center.y * scale, -center.z * scale)
  }, [variant])
  return <group ref={group}>{children}</group>
}

function GLBModel({ url, variant }: { url: string, variant?: string }) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => {
    const cloned = scene.clone(true)
    // FORCER la rotation du modèle lui-même
    cloned.rotation.y = -Math.PI / 2
    return cloned
  }, [scene])
  return (
    <FitToUnit variant={variant}>
      <primitive object={model} />
    </FitToUnit>
  )
}

function FallbackMesh({ variant = 'default' as 'conservative'|'balanced'|'aggressive'|'contrarian'|'default' }) {
  const geo = (() => {
    switch (variant) {
      case 'conservative': return <icosahedronGeometry args={[1, 1]} /> // Boule pour conservative
      case 'balanced': return <torusGeometry args={[0.9, 0.28, 16, 64]} />
      case 'aggressive': return <octahedronGeometry args={[1.4, 0]} /> // RAMIEL EVANGELION pour aggressive
      case 'contrarian': return <octahedronGeometry args={[1, 0]} />
      default: return <icosahedronGeometry args={[1, 1]} />
    }
  })()
  const color = (
    variant === 'conservative' ? '#7c3aed' : // VIOLETTE pour conservative
    variant === 'balanced' ? '#22c55e' :
    variant === 'aggressive' ? '#3b82f6' : // BLEU CLAIR IRISÉ RAMIEL pour aggressive
    variant === 'contrarian' ? '#0ea5e9' : '#7c3aed'
  )
  return (
    <FitToUnit variant={variant}>
      <mesh castShadow receiveShadow>
        {geo}
        <meshStandardMaterial color={color} metalness={0.25} roughness={0.35} />
      </mesh>
    </FitToUnit>
  )
}

function LookAtMouse({ target }: { target: React.RefObject<THREE.Group> }) {
  const mouse = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = (e.clientY / window.innerHeight) * 2 - 1
      mouse.current.x = THREE.MathUtils.clamp(nx, -1, 1)
      mouse.current.y = THREE.MathUtils.clamp(ny, -1, 1)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useFrame(() => {
    const g = target.current
    if (!g) return
    const yaw = mouse.current.x * 0.8
    const pitch = -mouse.current.y * 0.5
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, yaw, 0.08)
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, pitch, 0.08)
  })
  return null
}

function getVariantFromUrl(url: string): 'conservative'|'balanced'|'aggressive'|'contrarian'|'default' {
  const u = url.toLowerCase()
  if (u.includes('conservative')) return 'conservative'
  if (u.includes('balanced')) return 'balanced'
  if (u.includes('aggressive')) return 'aggressive'
  if (u.includes('contrarian')) return 'contrarian'
  return 'default'
}

export default function ModelStage({ modelUrl = '/model.glb' }: { modelUrl?: string }) {
  const root = useRef<THREE.Group>(null!)
  const [hasModel, setHasModel] = useState<boolean>(false)
  const fallbackVariant = getVariantFromUrl(modelUrl)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        let r = await fetch(modelUrl, { method: 'HEAD', cache: 'no-store' })
        if (!r.ok) {
          r = await fetch(modelUrl, { method: 'GET', cache: 'no-store' })
        }
        if (!active) return
        const ct = r.headers.get('content-type') || ''
        const ok = r.ok && !/text\/html/i.test(ct)
        setHasModel(ok)
      } catch {
        if (active) setHasModel(false)
      }
    })()
    return () => { active = false }
  }, [modelUrl])

  return (
    <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-[560px] h-[560px]">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 3.2], fov: 40 }} gl={{ antialias: true }} style={{ pointerEvents: 'none' }}>
        <group ref={root}>
          {/* FORCER placeholders pour aggressive et conservative */}
          {(fallbackVariant === 'aggressive' || fallbackVariant === 'conservative') ? (
            <FallbackMesh variant={fallbackVariant} />
          ) : hasModel ? (
            <GLBModel url={modelUrl} variant={fallbackVariant} />
          ) : (
            <FallbackMesh variant={fallbackVariant} />
          )}
          <LookAtMouse target={root} />
        </group>

        <ambientLight intensity={0.35} />
        <directionalLight position={[2, 4, 3]} intensity={0.9} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        <Environment preset="city" />
        <ContactShadows opacity={0.35} scale={8} blur={2.5} far={6} resolution={512} frames={1} position={[0, -1.1, 0]} />
      </Canvas>
    </div>
  )
}
