'use client'
import { useEffect, useRef, useState } from 'react'
import { parsePsaCert } from '@/lib/lending/psa'

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
type DetectorConstructor = new (options: { formats: string[] }) => Detector

export function PsaScanner({ onCert }: { onCert: (cert: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generation = useRef(0)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')

  function stop() {
    generation.current++
    if (timer.current) clearTimeout(timer.current)
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
  }
  useEffect(() => () => { stop() }, [])

  async function start() {
    stop(); setMessage('')
    const DetectorClass = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector
    if (!DetectorClass || !navigator.mediaDevices?.getUserMedia) {
      setMessage('このブラウザではQR読み取りに対応していません。鑑定番号またはQRコードのURLを入力してください。')
      return
    }
    setOpen(true)
    const current = generation.current
    try {
      const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      if (generation.current !== current) { camera.getTracks().forEach(track => track.stop()); return }
      stream.current = camera
      if (!video.current) { stop(); return }
      video.current.srcObject = camera
      await video.current.play()
      const detector = new DetectorClass({ formats: ['qr_code'] })
      const scan = async () => {
        if (generation.current !== current || !video.current) return
        try {
          const values = await detector.detect(video.current)
          if (generation.current !== current) return
          for (const value of values) {
            const cert = parsePsaCert(value.rawValue)
            if (cert) { onCert(cert); stop(); setOpen(false); setMessage('PSA鑑定番号を読み取りました。'); return }
          }
          if (values.length) setMessage('PSA公式のQRコードを読み取ってください。')
        } catch { /* Wait for the next frame when a video frame is not yet available. */ }
        if (generation.current === current) timer.current = setTimeout(scan, 250)
      }
      void scan()
    } catch {
      if (generation.current === current) {
        stop(); setOpen(false); setMessage('カメラを開始できません。番号またはQRコードURLを入力してください。')
      }
    }
  }
  return <div className="space-y-2">
    <button type="button" onClick={() => void start()} className="rounded-lg border border-amber-300/30 px-4 py-2 text-sm text-amber-200">QRコードを読み取る</button>
    {open && <div className="space-y-2">
      <video ref={video} autoPlay muted playsInline aria-label="PSA QRコード読み取り用カメラ" className="aspect-video w-full rounded-xl bg-black" />
      <button type="button" onClick={() => { stop(); setOpen(false) }} className="text-sm underline">カメラを閉じる</button>
    </div>}
    <p role="status" className="text-xs leading-5 text-zinc-400">{message}</p>
  </div>
}
