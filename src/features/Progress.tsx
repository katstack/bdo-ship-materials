export const Progress = ({ value }: { value: number }) => (
  <div className="progress">
    <i
      className={value === 100 ? 'done' : value >= 70 ? 'near' : ''}
      style={{ width: `${value}%` }}
    />
    <span>{value}%</span>
  </div>
)
