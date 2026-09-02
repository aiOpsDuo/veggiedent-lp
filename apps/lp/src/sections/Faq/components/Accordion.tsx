import { useState, useRef } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { gsap, useGSAP } from '../../../lib/gsap'
import type { FaqItem } from '../Faq.types'

interface AccordionProps {
  items: FaqItem[]
}

export function Accordion({ items }: AccordionProps) {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  // Stagger entry of accordion items on scroll
  useGSAP(() => {
    if (reducedMotion) return

    gsap.from('.accordion-item-el', {
      opacity: 0,
      y: 15,
      duration: 0.5,
      stagger: 0.08,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 85%',
        once: true,
      },
    })
  }, { scope: containerRef })

  const toggle = (index: number) => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  return (
    <div ref={containerRef} className="flex flex-col divide-y divide-black/10">
      {items.map((item, index) => (
        <AccordionItem
          key={item.question}
          item={item}
          index={index}
          isOpen={openItems.has(index)}
          onToggle={() => toggle(index)}
        />
      ))}
    </div>
  )
}

interface AccordionItemProps {
  item: FaqItem
  index: number
  isOpen: boolean
  onToggle: () => void
}

function AccordionItem({ item, index, isOpen, onToggle }: AccordionItemProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLSpanElement>(null)
  const reducedMotion = useReducedMotion()

  const panelId = `faq-panel-${index}`
  const buttonId = `faq-button-${index}`

  useGSAP(() => {
    if (!panelRef.current || !contentRef.current) return

    if (reducedMotion) {
      gsap.set(panelRef.current, {
        height: isOpen ? 'auto' : 0,
        opacity: isOpen ? 1 : 0,
        overflow: 'hidden',
      })
      if (iconRef.current) gsap.set(iconRef.current, { rotate: isOpen ? 45 : 0 })
      return
    }

    gsap.killTweensOf([panelRef.current, iconRef.current])
    gsap.set(panelRef.current, { overflow: 'hidden' })

    if (isOpen) {
      const targetHeight = contentRef.current.scrollHeight

      gsap.to(panelRef.current, {
        height: targetHeight,
        opacity: 1,
        duration: 0.4,
        ease: 'power2.out',
        onComplete: () => {
          if (panelRef.current) gsap.set(panelRef.current, { height: 'auto', overflow: 'visible' })
        },
      })

      if (iconRef.current) {
        gsap.to(iconRef.current, { rotate: 45, duration: 0.25, ease: 'power2.out' })
      }
    } else {
      gsap.to(panelRef.current, {
        height: 0,
        opacity: 0,
        duration: 0.35,
        ease: 'power2.out',
      })

      if (iconRef.current) {
        gsap.to(iconRef.current, { rotate: 0, duration: 0.25, ease: 'power2.out' })
      }
    }
  }, { dependencies: [isOpen], scope: panelRef })

  return (
    <div className="accordion-item-el">
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full min-h-[44px] items-center justify-between gap-4 py-4 text-left text-base font-semibold text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
        >
          {item.question}
          <span
            ref={iconRef}
            aria-hidden="true"
            className="inline-flex shrink-0 items-center justify-center"
          >
            {isOpen ? <Minus size={20} /> : <Plus size={20} />}
          </span>
        </button>
      </h3>
      <div
        ref={panelRef}
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        aria-hidden={!isOpen}
        style={{ height: 0, opacity: 0, overflow: 'hidden' }}
      >
        <div ref={contentRef}>
          <p className="pb-4 text-base text-ink-700">{item.answer}</p>
        </div>
      </div>
    </div>
  )
}

