import { useRef, useState, type ComponentProps } from 'react'

type Props = Omit<
  ComponentProps<'input'>,
  'type' | 'value' | 'onChange' | 'min' | 'max' | 'step' | 'onFocus' | 'onBlur' | 'onMouseUp'
> & {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  integer?: boolean
}

/** Keep editable text separate from the valid number saved by the parent. */
export function QuantityInput({
  value,
  onValueChange,
  min = 1,
  max = 1e9,
  integer = true,
  ...props
}: Props) {
  const [draft, setDraft] = useState<{ source: number; text: string }>()
  const selectOnMouseUp = useRef(false)
  return (
    <input
      {...props}
      type="number"
      min={min}
      max={max}
      step={integer ? 1 : 'any'}
      value={draft?.source === value ? draft.text : String(value)}
      onFocus={(event) => {
        event.currentTarget.select()
        selectOnMouseUp.current = true
      }}
      onMouseUp={(event) => {
        if (selectOnMouseUp.current) {
          event.preventDefault()
          event.currentTarget.select()
          selectOnMouseUp.current = false
        }
      }}
      onChange={(event) => {
        const text = event.currentTarget.value
        const next = Number(text)
        const valid =
          text !== '' &&
          Number.isFinite(next) &&
          next >= min &&
          next <= max &&
          (!integer || Number.isSafeInteger(next))
        setDraft({ source: valid ? next : value, text })
        if (valid) onValueChange(next)
      }}
      onBlur={() => {
        setDraft(undefined)
        selectOnMouseUp.current = false
      }}
    />
  )
}
