export function SectionDivider() {
  return (
    <div className="flex items-center justify-center py-2">
      <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold/40" />
      <div className="mx-3 flex items-center gap-1.5">
        <div className="h-1 w-1 rounded-full bg-gold/60" />
        <div className="h-1.5 w-1.5 rounded-full bg-gold" />
        <div className="h-1 w-1 rounded-full bg-gold/60" />
      </div>
      <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold/40" />
    </div>
  )
}
