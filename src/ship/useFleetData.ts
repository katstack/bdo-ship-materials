import { useCallback, useState } from 'react'
import type { AppData } from '../types'
import { hasStoredData, loadData, saveData } from '../storage'

/** Local persistence survives tool navigation; remote replacement never stamps a new revision. */
export function useFleetData() {
  const [data, setData] = useState<AppData>(loadData)
  const [hasLocalProgress, setHasLocalProgress] = useState(hasStoredData)
  const [notice, setNotice] = useState('')
  const update = useCallback((next: AppData) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() }
    setData(stamped)
    setHasLocalProgress(true)
    try {
      saveData(stamped)
      setNotice('로컬 저장됨')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '저장 실패')
    }
  }, [])
  const replaceLocal = useCallback((next: AppData) => {
    setData(next)
    setHasLocalProgress(true)
    saveData(next)
    setNotice('Drive 데이터를 불러왔습니다.')
  }, [])

  return { data, hasLocalProgress, notice, setNotice, update, replaceLocal }
}
