import Link from 'next/link'

export function LegalFooter() {
  return (
    <footer className="border-border/40 border-t">
      <nav
        aria-label="Legal"
        className="text-muted-foreground mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-2 px-6 py-6 text-sm"
      >
        <Link href="/privacy" className="hover:text-foreground transition-colors">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:text-foreground transition-colors">
          Terms of Service
        </Link>
        <Link href="/data-deletion" className="hover:text-foreground transition-colors">
          Data Deletion
        </Link>
      </nav>
    </footer>
  )
}
