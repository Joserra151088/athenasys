export default function PageHeader({ title, subtitle, children }) {
  return (
    <div
      className="rounded-2xl px-7 py-5 text-white relative overflow-hidden"
      style={{
        background: 'linear-gradient(120deg, #0d1b3e 0%, #1a3471 50%, #2d5ab0 100%)',
        boxShadow: '0 4px 20px rgba(26,52,113,0.18)',
      }}
    >
      <div
        className="absolute -top-8 -right-8 w-44 h-44 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(122,180,255,0.15), transparent)' }}
      />
      <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-blue-200 text-sm mt-0.5">{subtitle}</p>}
        </div>
        {children && (
          <div className="flex gap-2 flex-wrap items-start">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
