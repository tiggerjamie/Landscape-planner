import { useEffect, useState } from 'react'
import { lengthToInputValue, parseLength, unitLabel, type Units } from '../units'

/**
 * Form controls shared by the inspector. The length input is the important
 * one: it holds the user's raw text while they type and only commits when the
 * text parses, so a half-typed 12'6" never collapses to 12.
 */

export function LengthInput({
  label,
  value,
  units,
  onChange,
  min,
  help,
}: {
  label: string
  value: number
  units: Units
  onChange: (meters: number) => void
  min?: number
  help?: string
}) {
  const [text, setText] = useState(() => lengthToInputValue(value, units))
  const [invalid, setInvalid] = useState(false)
  const [editing, setEditing] = useState(false)

  // Track external changes (undo, a drag, a unit switch) unless mid-edit.
  useEffect(() => {
    if (!editing) setText(lengthToInputValue(value, units))
  }, [value, units, editing])

  const commit = (raw: string) => {
    const parsed = parseLength(raw, units)
    if (parsed === null) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    onChange(min !== undefined ? Math.max(min, parsed) : parsed)
  }

  return (
    <label className="field">
      <span className="field__label">
        {label}
        {help && <em className="field__help">{help}</em>}
      </span>
      <span className="field__input-wrap">
        <input
          className={`field__input ${invalid ? 'field__input--invalid' : ''}`}
          value={text}
          inputMode="decimal"
          onFocus={() => setEditing(true)}
          onChange={(e) => {
            setText(e.target.value)
            setInvalid(false)
          }}
          onBlur={(e) => {
            setEditing(false)
            commit(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <span className="field__unit">{unitLabel(units)}</span>
      </span>
    </label>
  )
}

export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  help,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  help?: string
}) {
  return (
    <label className="field">
      <span className="field__label">
        {label}
        {help && <em className="field__help">{help}</em>}
      </span>
      <input
        className="field__input"
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const next = Number(e.target.value)
          if (Number.isFinite(next)) onChange(next)
        }}
      />
    </label>
  )
}

export function SelectInput({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  help?: string
}) {
  return (
    <label className="field">
      <span className="field__label">
        {label}
        {help && <em className="field__help">{help}</em>}
      </span>
      <select className="field__input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ToggleInput({
  label,
  value,
  onChange,
  help,
}: {
  label: string
  value: boolean
  onChange: (value: boolean) => void
  help?: string
}) {
  return (
    <label className="field field--inline">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span className="field__label">
        {label}
        {help && <em className="field__help">{help}</em>}
      </span>
    </label>
  )
}

export function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        className="field__input field__input--color"
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

export function TextInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input className="field__input" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
