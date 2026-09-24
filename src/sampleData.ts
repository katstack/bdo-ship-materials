import type { AppData } from './types'

export const sampleData: AppData = {
  version: 1,
  updatedAt: new Date().toISOString(),
  inventory: { '섬나무 증착합판': 48, '강화된 섬나무 증착합판': 12, '심해의 기억이 담긴 접착제': 8, '콕스 해적단의 유물': 42, '달의 비늘이 새겨진 합판': 20, '암염 주괴': 5 },
  equipment: [
    { id: 'figurehead', name: '무역선 선수상', grade: '파란 등급', materials: [{ id: 'f1', name: '섬나무 증착합판', required: 100, note: '오킬루아의 눈 교환', crowCoinPrice: 160 }, { id: 'f2', name: '심해의 기억이 담긴 접착제', required: 30, note: '까마귀 주화 교환', crowCoinPrice: 600 }] },
    { id: 'plating', name: '무역선 장갑', grade: '파란 등급', materials: [{ id: 'p1', name: '강화된 섬나무 증착합판', required: 50, note: '가공 재료', crowCoinPrice: 400 }, { id: 'p2', name: '콕스 해적단의 유물', required: 80, note: '해양 몬스터', crowCoinPrice: 100 }] },
    { id: 'sail', name: '무역선 돛', grade: '파란 등급', materials: [{ id: 's1', name: '섬나무 증착합판', required: 80, note: '오킬루아의 눈 교환', crowCoinPrice: 160 }, { id: 's2', name: '달의 비늘이 새겨진 합판', required: 50, note: '까마귀 주화 교환', crowCoinPrice: 160 }] },
    { id: 'cannon', name: '무역선 함포', grade: '파란 등급', materials: [{ id: 'c1', name: '콕스 해적단의 유물', required: 100, note: '해양 몬스터', crowCoinPrice: 100 }, { id: 'c2', name: '암염 주괴', required: 20, note: '가공/거래소' }] }
  ]
}
