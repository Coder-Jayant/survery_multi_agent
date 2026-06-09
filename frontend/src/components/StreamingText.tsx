import { useEffect, useRef, useState } from 'react'

interface StreamingTextProps {
  text: string
  speed?: number
  className?: string
  onDone?: () => void
}

export function StreamingText({ text, speed = 12, className, onDone }: StreamingTextProps) {
  const [displayed, setDisplayed] = useState('')
  const indexRef = useRef(0)
  const prevText = useRef('')

  useEffect(() => {
    if (text === prevText.current) return
    if (text.startsWith(prevText.current)) {
      // continuation
    } else {
      setDisplayed('')
      indexRef.current = 0
    }
    prevText.current = text
  }, [text])

  useEffect(() => {
    if (indexRef.current >= text.length) return
    const timer = setInterval(() => {
      indexRef.current++
      setDisplayed(text.slice(0, indexRef.current))
      if (indexRef.current >= text.length) {
        clearInterval(timer)
        onDone?.()
      }
    }, speed)
    return () => clearInterval(timer)
  }, [text, speed, onDone])

  return (
    <span className={className}>
      {displayed}
      {displayed.length < text.length && (
        <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 animate-pulse align-middle" />
      )}
    </span>
  )
}
