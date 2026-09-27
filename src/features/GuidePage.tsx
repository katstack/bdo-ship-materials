import type { MaterialDefinition } from '../types'
import { number } from '../utils'

interface GuidePageProps {
  materials: MaterialDefinition[]
  query: string
  onQueryChange: (query: string) => void
}

export function GuidePage({ materials, query, onQueryChange }: GuidePageProps) {
  return (
    <section>
      <div className="toolbar">
        <input
          placeholder="재료명 검색"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <span className="save">고정 게임 데이터 · 편집 불가</span>
      </div>
      <div className="guide-grid">
        {materials
          .filter((material) => material.name.includes(query))
          .map((material) => (
            <article className="guide-card" key={material.id}>
              <h3>{material.name}</h3>
              <b>
                {material.crowCoinPrice === undefined
                  ? '까마귀 주화 단가 미확인'
                  : `${number(material.crowCoinPrice)} 까마귀 주화 / 개`}
              </b>
              <ul>
                {material.sources.map((source) => (
                  <li key={source}>{source}</li>
                ))}
              </ul>
            </article>
          ))}
      </div>
    </section>
  )
}
