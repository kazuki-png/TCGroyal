'use client'

import { useEffect, useState } from 'react'

type ImageUploadPreviewInputProps = {
  name: string
  accept: string
  label?: string
  required?: boolean
  currentImageUrl?: string | null
  currentText?: string
  emptyText?: string
  error?: string
  previewClassName?: string
  inputLabelClassName?: string
  textClassName?: string
  errorClassName?: string
  onFileNameChange?: (fileName: string | undefined) => void
}

export function ImageUploadPreviewInput({
  name,
  accept,
  label,
  required,
  currentImageUrl,
  currentText,
  emptyText = '画像を選択',
  error,
  previewClassName = 'relative h-32 w-full overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950',
  inputLabelClassName = 'flex h-10 cursor-pointer items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-900',
  textClassName = 'mb-1.5 block text-sm text-zinc-400',
  errorClassName = 'mt-1 text-xs font-semibold text-red-400',
  onFileNameChange,
}: ImageUploadPreviewInputProps) {
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [fileName, setFileName] = useState<string>()
  const previewImage = previewUrl ?? currentImageUrl

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  return (
    <div>
      {label && (
        <span className={textClassName}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
      )}

      <div
        className={previewClassName}
        aria-label={fileName ? `${fileName}のプレビュー` : '画像プレビュー'}
      >
        {previewImage ? (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url("${previewImage}")` }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs font-semibold text-zinc-500">
            {currentText ?? '選択した画像がここに表示されます'}
          </div>
        )}
      </div>

      <label className={`${inputLabelClassName} mt-2`}>
        {fileName ?? currentText ?? emptyText}
        <input
          name={name}
          type="file"
          required={required}
          accept={accept}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            setFileName(file?.name)
            onFileNameChange?.(file?.name)

            setPreviewUrl((previousUrl) => {
              if (previousUrl) URL.revokeObjectURL(previousUrl)
              return file ? URL.createObjectURL(file) : undefined
            })
          }}
        />
      </label>
      {error && <p className={errorClassName}>{error}</p>}
    </div>
  )
}
