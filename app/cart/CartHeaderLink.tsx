'use client'

import { useEffect, useState } from 'react'

export const CART_TOTAL_QUANTITY_EVENT = 'cart-total-quantity-change'
export const CART_OPEN_REQUEST_EVENT = 'cart-open-request'

export function CartHeaderLink() {
  const [quantity, setQuantity] = useState(0)

  useEffect(() => {
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail
      setQuantity(typeof detail === 'number' ? detail : 0)
    }

    window.addEventListener(CART_TOTAL_QUANTITY_EVENT, handleChange)
    return () =>
      window.removeEventListener(CART_TOTAL_QUANTITY_EVENT, handleChange)
  }, [])

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(CART_OPEN_REQUEST_EVENT))}
      aria-label={`カート ${quantity}点`}
      className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-950 shadow-sm transition-colors hover:bg-zinc-100"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.3"
      >
        <path d="M4 6h3.5l2.3 15h16l2.2-11H9" />
        <path d="M11 15h16" />
        <path d="M14 10v11" />
        <path d="M20 10v11" />
        <circle cx="13" cy="26" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="25" cy="26" r="1.8" fill="currentColor" stroke="none" />
      </svg>
      {quantity > 0 && (
        <span className="absolute -bottom-1 -right-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white ring-2 ring-white">
          {quantity}
        </span>
      )}
    </button>
  )
}
