export default function Badge({ label, color }) {
  return (
    <span className={`badge ${color}`}>{label}</span>
  )
}
