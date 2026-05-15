import * as React from 'react'

export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated: string
  children: React.ReactNode
}) {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground text-sm">Last updated: {lastUpdated}</p>
      </header>
      <div className="space-y-6 text-sm leading-relaxed [&_a]:underline [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_p]:mt-2 [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </article>
  )
}
