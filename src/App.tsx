import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  dailyTasks,
  defaultEquipmentOrder,
  defaultUpgradeHull,
  hullLabel,
  materials,
  materialById,
  recipes,
  stageLabel,
  upgradeTargets,
} from "./catalog";
import {
  clearData,
  freshSample,
  loadData,
  normalize,
  saveData,
} from "./storage";
import { useDriveSync } from "./useDriveSync";
import type { AggregateMaterial, AppData, DailyTask, Hull, MaterialExchangeSortKey, MaterialSortKey, Ship, Stage, SupplyPlan } from "./types";
import {
  aggregate,
  clamp,
  number,
  materialSupply,
  recipeProgress,
  shipRecipes,
  stageProgress,
  craftRecordKey,
  isRecipeCompleted,
} from "./utils";
import { locationById, locations } from "./data/locations";
import { npcById } from "./data/npcs";
import { questRoutes } from "./data/questRoutes";
import { codexNpcUrl, codexQuestUrl } from "./data/codex";
import type { QuestRoute } from "./types";
import { materialExchangeOutput } from "./data/materialExchanges";

type Tab = "dashboard" | "ship" | "materials" | "daily" | "guide" | "settings";
type MaterialsView = "inventory" | "barter";
type BarterRow = AggregateMaterial & { outputQuantity: number; afterExchangeShortage: number; progressGain: number; exchangeCrowValue?: number; priority: number };
const tabs: Tab[] = ["dashboard", "ship", "materials", "daily", "guide", "settings"];
const tabFromUrl = (): Tab => {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tabs.includes(tab as Tab) ? (tab as Tab) : "dashboard";
};
const materialsViewFromUrl = (): MaterialsView =>
  new URLSearchParams(window.location.search).get("view") === "barter" ? "barter" : "inventory";
const toBarterRows = (rows: AggregateMaterial[], exchangeCounts: Record<string, number> = {}): BarterRow[] => rows.filter((row) => row.shortage > 0 || (exchangeCounts[row.id] || 0) > 0).map((row) => {
  const outputQuantity = materialExchangeOutput(row.id);
  const gained = Math.min(outputQuantity, row.shortage);
  const afterExchangeShortage = row.shortage - gained;
  const afterProgress = row.required ? Math.min(100, Math.round(((row.owned + gained) / row.required) * 100)) : 100;
  const exchangeCrowValue = row.crowCoinPrice === undefined ? undefined : gained * row.crowCoinPrice;
  return { ...row, outputQuantity, afterExchangeShortage, progressGain: afterProgress - row.progress, exchangeCrowValue, priority: exchangeCrowValue ?? -1 };
});
const sortBarterRows = (rows: BarterRow[], key: MaterialExchangeSortKey, direction: "asc" | "desc") => [...rows].sort((a, b) => {
  const av = key === "name" ? a.name : a[key]; const bv = key === "name" ? b.name : b[key];
  if (av === undefined) return 1;
  if (bv === undefined) return -1;
  const base = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv, "ko") : Number(av) - Number(bv);
  return direction === "asc" ? base : -base;
});
const id = () => crypto.randomUUID();
const Progress = ({ value }: { value: number }) => (
  <div className="progress">
    <i
      className={value === 100 ? "done" : value >= 70 ? "near" : ""}
      style={{ width: `${value}%` }}
    />
    <span>{value}%</span>
  </div>
);
const Num = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (x: number) => void;
}) => (
  <input
    className="num"
    type="number"
    min="0"
    value={value}
    onChange={(e) => onChange(clamp(e.target.valueAsNumber))}
  />
);
const newShip = (hull: Hull): Ship => ({
  id: id(),
  name: `${hullLabel[hull]} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
  hull,
  activeStage: hull === "trade" || hull === "warship" ? 1 : 3,
  upgradeHull:
    hull === "trade" || hull === "warship"
      ? defaultUpgradeHull[hull]
      : undefined,
  equipmentOrder: [...defaultEquipmentOrder[hull]],
});
const sortMaterials = (
  rows: ReturnType<typeof aggregate>,
  key: MaterialSortKey,
  direction: "asc" | "desc",
) =>
  [...rows].sort((a, b) => {
    const av = key === "recipes" ? a.recipes.join(", ") : a[key];
    const bv = key === "recipes" ? b.recipes.join(", ") : b[key];
    if (av === undefined) return 1;
    if (bv === undefined) return -1;
    const base =
      typeof av === "string" && typeof bv === "string"
        ? av.localeCompare(bv, "ko")
        : Number(av) - Number(bv);
    return direction === "asc" ? base : -base;
  });

export default function App() {
  const [data, setData] = useState<AppData>(loadData);
  const [tab, setTab] = useState<Tab>(tabFromUrl);
  const [selected, setSelected] = useState(() => {
    const shipId = new URLSearchParams(window.location.search).get("ship");
    return data.ships.some((ship) => ship.id === shipId) ? shipId! : (data.ships[0]?.id || "");
  });
  const [scope, setScope] = useState<"current" | "all">("all");
  const [materialsView, setMaterialsView] = useState<MaterialsView>(materialsViewFromUrl);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [barterToast, setBarterToast] = useState<{ id: string; materialId: string; quantity: number } | null>(null);
  const [barterFlashId, setBarterFlashId] = useState<string | null>(null);
  const [craftConfirm, setCraftConfirm] = useState<{ shipId: string; recipeId: string } | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [supplyDetail, setSupplyDetail] = useState<{
    materialId: string;
    period: "daily" | "weekly";
  } | null>(null);
  const [manualAdds, setManualAdds] = useState<Record<string, string>>({});
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab === "dashboard") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    if (selected) url.searchParams.set("ship", selected);
    else url.searchParams.delete("ship");
    if (materialsView === "barter") url.searchParams.set("view", "barter");
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [tab, selected, materialsView]);
  useEffect(() => {
    const restoreUrlState = () => {
      setTab(tabFromUrl());
      setMaterialsView(materialsViewFromUrl());
      const shipId = new URLSearchParams(window.location.search).get("ship");
      setSelected(data.ships.some((ship) => ship.id === shipId) ? shipId! : (data.ships[0]?.id || ""));
    };
    window.addEventListener("popstate", restoreUrlState);
    return () => window.removeEventListener("popstate", restoreUrlState);
  }, [data.ships]);
  const update = (next: AppData) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    setData(stamped);
    try {
      saveData(stamped);
      setNotice("로컬 저장됨");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "저장 실패");
    }
  };
  const replaceLocal = (next: AppData) => {
    setData(next);
    saveData(next);
    setNotice("Drive 데이터를 불러왔습니다.");
  };
  const drive = useDriveSync(data, replaceLocal);
  const totals = useMemo(() => aggregate(data, scope), [data, scope]);
  const allTotals = useMemo(() => aggregate(data, "all"), [data]);
  const orderedTotals = sortMaterials(
    totals,
    data.materialSort.key,
    data.materialSort.direction,
  );
  const barterRows = useMemo(
    () => toBarterRows(totals, data.barterSession.exchangeCounts),
    [totals, data.barterSession.exchangeCounts],
  );
  const orderedBarterRows = sortBarterRows(barterRows, data.materialExchangeSort.key, data.materialExchangeSort.direction);
  const currentShip = data.ships.find((s) => s.id === selected);
  const currentRecipes = currentShip
    ? [...shipRecipes(currentShip)].sort(
        (a, b) =>
          (a.slot ? currentShip.equipmentOrder.indexOf(a.slot) : 99) -
          (b.slot ? currentShip.equipmentOrder.indexOf(b.slot) : 99),
      )
    : [];
  const pendingRecipes = currentShip ? currentRecipes.filter((recipe) => !isRecipeCompleted(data, currentShip.id, recipe.id)) : [];
  const completedCurrentRecipes = currentShip ? currentRecipes.filter((recipe) => isRecipeCompleted(data, currentShip.id, recipe.id)) : [];
  const totalCrow = totals.reduce((s, x) => s + (x.crowCoinTotal || 0), 0);
  const priced = totals.filter((x) => x.crowCoinPrice !== undefined).length;
  const setOwned = (materialId: string, value: number) =>
    update({ ...data, inventory: { ...data.inventory, [materialId]: value } });
  const completeCraft = () => {
    if (!craftConfirm) return;
    const ship = data.ships.find((item) => item.id === craftConfirm.shipId);
    const recipe = ship && shipRecipes(ship).find((item) => item.id === craftConfirm.recipeId);
    if (!ship || !recipe || isRecipeCompleted(data, ship.id, recipe.id)) return setCraftConfirm(null);
    if (recipe.requirements.some((requirement) => clamp(data.inventory[requirement.materialId]) < requirement.quantity)) {
      setNotice("재료 보유량이 부족하여 제작을 완료할 수 없습니다.");
      return setCraftConfirm(null);
    }
    const consumedMaterials = Object.fromEntries(recipe.requirements.map((requirement) => [requirement.materialId, requirement.quantity]));
    const inventory = { ...data.inventory };
    recipe.requirements.forEach((requirement) => { inventory[requirement.materialId] = clamp(inventory[requirement.materialId]) - requirement.quantity; });
    update({ ...data, inventory, completedRecipes: { ...data.completedRecipes, [craftRecordKey(ship.id, recipe.id)]: { completedAt: new Date().toISOString(), consumedMaterials } } });
    setCraftConfirm(null);
    setNotice(`${recipe.name} 제작 완료 · 재료를 공유 재고에서 차감했습니다.`);
  };
  const undoCraft = (ship: Ship, recipeId: string) => {
    const key = craftRecordKey(ship.id, recipeId);
    const record = data.completedRecipes[key];
    if (!record || !confirm("제작 완료를 취소하고 당시 차감한 재료를 재고에 복구할까요?")) return;
    const inventory = { ...data.inventory };
    Object.entries(record.consumedMaterials).forEach(([materialId, quantity]) => { inventory[materialId] = clamp(inventory[materialId]) + quantity; });
    const completedRecipes = { ...data.completedRecipes };
    delete completedRecipes[key];
    update({ ...data, inventory, completedRecipes });
    setNotice("제작 완료를 취소하고 재료를 공유 재고에 복구했습니다.");
  };
  const setSupplyPlan = (
    task: DailyTask,
    patch: { enabled?: boolean; choiceId?: string },
  ) =>
    update({
      ...data,
      supplyPlans: {
        ...data.supplyPlans,
        [task.id]: { ...data.supplyPlans[task.id], ...patch },
      },
    });
  const chooseRoute = (route: QuestRoute, optionId: string) => {
    const selectedOption = route.options.find((option) => option.id === optionId);
    if (!selectedOption) return;
    const routeQuestIds = route.options.flatMap((option) => option.questIds);
    const supplyPlans = { ...data.supplyPlans };
    supplyPlans[`route:${route.id}`] = { enabled: true, choiceId: optionId };
    routeQuestIds.forEach((questId) => {
      supplyPlans[questId] = {
        ...supplyPlans[questId],
        enabled: false,
      };
    });
    update({ ...data, supplyPlans });
  };
  const addManual = (materialId: string) => {
    const amount = clamp(Number(manualAdds[materialId]));
    if (!amount) {
      setNotice("추가할 수량을 1 이상 입력하세요.");
      return;
    }
    setOwned(materialId, clamp(data.inventory[materialId]) + amount);
    setManualAdds({ ...manualAdds, [materialId]: "" });
    setNotice(
      `${materialById[materialId].name} ${number(amount)}개를 추가했습니다.`,
    );
  };
  const setMaterialSort = (key: MaterialSortKey) =>
    update({
      ...data,
      materialSort: {
        key,
        direction:
          data.materialSort.key === key &&
          data.materialSort.direction === "desc"
            ? "asc"
            : "desc",
      },
    });
  const setMaterialExchangeSort = (key: MaterialExchangeSortKey) =>
    update({ ...data, materialExchangeSort: { key, direction: data.materialExchangeSort.key === key && data.materialExchangeSort.direction === "desc" ? "asc" : "desc" } });
  const updateBarterSession = (patch: Partial<AppData["barterSession"]>) => update({ ...data, barterSession: { ...data.barterSession, ...patch } });
  useEffect(() => {
    if (!barterToast) return;
    let remaining = 4000; let started = 0; let timer: number | undefined;
    const pauseOrResume = () => { if (document.visibilityState === "hidden") { if (timer) window.clearTimeout(timer); remaining -= Date.now() - started; } else { started = Date.now(); timer = window.setTimeout(() => setBarterToast(null), Math.max(0, remaining)); } };
    pauseOrResume(); document.addEventListener("visibilitychange", pauseOrResume);
    return () => { if (timer) window.clearTimeout(timer); document.removeEventListener("visibilitychange", pauseOrResume); };
  }, [barterToast?.id]);
  const addBarterListing = (row: BarterRow) => {
    const session = data.barterSession;
    const exchangeCounts = { ...session.exchangeCounts, [row.id]: (session.exchangeCounts[row.id] || 0) + 1 };
    update({ ...data, barterSession: { ...session, exchangeCounts } });
    setBarterFlashId(row.id); window.setTimeout(() => setBarterFlashId((current) => current === row.id ? null : current), 420);
  };
  const removeBarterListing = (row: BarterRow) => {
    const session = data.barterSession; const count = session.exchangeCounts[row.id] || 0;
    if (!count) return;
    const exchangeCounts = { ...session.exchangeCounts, [row.id]: count - 1 };
    update({ ...data, barterSession: { ...session, exchangeCounts } });
    setBarterFlashId(row.id); window.setTimeout(() => setBarterFlashId((current) => current === row.id ? null : current), 420);
  };
  const completeBarter = (row: BarterRow) => {
    const session = data.barterSession; const count = session.exchangeCounts[row.id] || 0;
    if (!count) return;
    const exchangeCounts = { ...session.exchangeCounts, [row.id]: count - 1 };
    const inventory = session.addToInventory ? { ...data.inventory, [row.id]: clamp(data.inventory[row.id]) + row.outputQuantity } : data.inventory;
    update({ ...data, inventory, barterSession: { ...session, exchangeCounts } });
    if (session.addToInventory) setBarterToast((previous) => previous?.materialId === row.id ? { ...previous, id: id(), quantity: previous.quantity + row.outputQuantity } : { id: id(), materialId: row.id, quantity: row.outputQuantity });
  };
  const editShip = (ship: Ship) =>
    update({
      ...data,
      ships: data.ships.map((x) => (x.id === ship.id ? ship : x)),
    });
  const removeShip = (ship: Ship) => {
    if (!confirm(`${ship.name}을 함대에서 제거할까요?`)) return;
    const ships = data.ships.filter((x) => x.id !== ship.id);
    update({ ...data, ships });
    setSelected(ships[0]?.id || "");
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bdo-fleet-profile-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importData = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      update(normalize(JSON.parse(await f.text())));
      setNotice("진행 데이터를 가져왔습니다.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "가져오기 실패");
    } finally {
      e.target.value = "";
    }
  };
  return (
    <main>
      <header>
        <div className="brand">
          <img
            src={`${import.meta.env.BASE_URL}ship-growth-logo.png`}
            alt="함선 성장 재료 관리 로고"
          />
          <div>
            <p className="eyebrow">BLACK DESERT · FLEET PROGRESSION</p>
            <h1>함선 성장 재료 관리</h1>
          </div>
        </div>
        <div className="header-status">
          <button
            className={`drive-status ${drive.status}`}
            onClick={
              drive.status === "disconnected" || drive.status === "failed"
                ? drive.authorize
                : undefined
            }
          >
            {drive.status === "disconnected"
              ? "Google Drive 연결"
              : drive.status === "connecting"
                ? "Drive 연결 중…"
                : drive.status === "synced"
                  ? "● 동기화됨"
                  : "● 동기화 실패"}
          </button>
          <span className="save">
            {drive.lastSavedAt
              ? `Drive 저장 ${new Date(drive.lastSavedAt).toLocaleString("ko-KR")}`
              : notice || "LocalStorage 자동 저장"}
          </span>
        </div>
      </header>
      <nav>
        {(
          [
            ["dashboard", "함대 현황"],
            ["ship", "선박 단계"],
            ["materials", "전체 재료"],
            ["daily", "일일 수급"],
            ["guide", "수급 도감"],
            ["settings", "함대·백업"],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
            key={k}
          >
            {l}
          </button>
        ))}
      </nav>
      {tab === "dashboard" && (
        <section>
          <div className="hero">
            <div>
              <p>추적 중인 함선</p>
              <strong>{data.ships.length}</strong>
              <span className="hero-copy">척 · 공유 재고 기준</span>
            </div>
            <div className="stat">
              <b>{totals.filter((x) => x.shortage > 0).length}</b>
              <span>개 재료 부족</span>
            </div>
            <div className="stat">
              <b>{number(totalCrow)}</b>
              <span>까마귀 주화 필요 (단가 확인분)</span>
            </div>
          </div>
          <h2>내 함대</h2>
          <div className="cards">
            {data.ships.map((ship) => {
              const p = stageProgress(data, ship);
              return (
                <button
                  className="card"
                  onClick={() => {
                    setSelected(ship.id);
                    setTab("ship");
                  }}
                  key={ship.id}
                >
                  <span>
                    {hullLabel[ship.hull]} · {stageLabel[ship.activeStage]}
                  </span>
                  <h3>{ship.name}</h3>
                  <Progress value={p} />
                  <small>
                    {p === 100
                      ? "현재 단계 준비 완료"
                      : "현재 단계 재료 준비 중"}
                  </small>
                </button>
              );
            })}
            {!data.ships.length && (
              <p className="empty">함대·백업 탭에서 선박을 추가하세요.</p>
            )}
          </div>
          <h2>가장 부족한 재료</h2>
          <div className="top-list">
            {aggregate(data, "current")
              .filter((x) => x.shortage)
              .sort((a, b) => b.shortage - a.shortage)
              .slice(0, 5)
              .map((x) => (
                <div key={x.id}>
                  <b>{x.name}</b>
                  <span>
                    필요 {number(x.required)} · 보유 {number(x.owned)} ·{" "}
                    <em>부족 {number(x.shortage)}</em>
                  </span>
                </div>
              ))}
          </div>
          <div className="section-title barter-summary-title">
            <div><p>물교 1회로 까주 구매를 가장 많이 대체하는 부족 재료</p><h2>이번 물교 추천</h2></div>
            <button onClick={() => { setMaterialsView("barter"); setTab("materials"); }}>전체 보기</button>
          </div>
          <div className="top-list barter-top-list">
            {sortBarterRows(barterRows, "priority", "desc").slice(0, 3).map((row) => <div key={row.id}><b>{row.name} <small>1 : {number(row.outputQuantity)}</small></b><span>{row.exchangeCrowValue === undefined ? "까주 단가 미확인" : `물교 1회 = ${number(row.exchangeCrowValue)} 주화 상당`} · 부족 {number(row.shortage)}</span></div>)}
            {!barterRows.length && <p className="empty">현재 범위에 부족한 재료가 없습니다.</p>}
          </div>
        </section>
      )}
      {tab === "ship" && (
        <section>
          {
            <div className="equip-tabs">
              {data.ships.map((ship) => (
                <button
                  key={ship.id}
                  className={ship.id === selected ? "active" : ""}
                  onClick={() => setSelected(ship.id)}
                >
                  {ship.name}
                </button>
              ))}
            </div>
          }
          {currentShip ? (
            <>
              <div className="section-title">
                <div>
                  <p>
                    {hullLabel[currentShip.hull]} ·{" "}
                    {stageLabel[currentShip.activeStage]}
                  </p>
                  <h2>{currentShip.name}</h2>
                </div>
                <Progress value={stageProgress(data, currentShip)} />
              </div>
              <div className="stepper">
                {([1, 2, 3, 4, 5] as Stage[]).map((s) => (
                  <button
                    key={s}
                    className={
                      s === currentShip.activeStage
                        ? "active"
                        : s < currentShip.activeStage
                          ? "past"
                          : ""
                    }
                    onClick={() => editShip({ ...currentShip, activeStage: s })}
                  >
                    <b>{s}</b>
                    {stageLabel[s]}
                  </button>
                ))}
              </div>
              {(currentShip.hull === "trade" || currentShip.hull === "warship") && (
                <label className="upgrade-choice">
                  중범선 증축 목표
                  <select
                    value={
                      currentShip.upgradeHull ||
                      defaultUpgradeHull[currentShip.hull]
                    }
                    onChange={(e) =>
                      editShip({
                        ...currentShip,
                        upgradeHull: e.target.value as Ship["upgradeHull"],
                      })
                    }
                  >
                    {upgradeTargets[currentShip.hull].map((hull) => (
                      <option key={hull} value={hull}>
                        {hullLabel[hull]}
                      </option>
                    ))}
                  </select>
                  <small>3단계 증축을 누르면 선택한 목표의 재료를 집계합니다.</small>
                </label>
              )}
              <p className="muted">
                단계를 클릭하면 해당 단계의 고정 제작식만 봅니다. 재료 보유량은
                함대 전체에서 공유됩니다.
              </p>
              {pendingRecipes.map((recipe, index) => {
                const canCraft = recipe.requirements.every((requirement) => clamp(data.inventory[requirement.materialId]) >= requirement.quantity);
                return (
                <article className="recipe" key={recipe.id}>
                  <div>
                    <p>진행률 {recipeProgress(recipe, data.inventory)}%</p>
                    <h3>{recipe.name}</h3>
                    <small>{recipe.description}</small>
                  </div>
                  {recipe.slot && (
                    <span className="order-actions">
                      <button
                        disabled={index === 0}
                        onClick={() => {
                          const order = [...currentShip.equipmentOrder];
                          const position = order.indexOf(recipe.slot!);
                          [order[position - 1], order[position]] = [
                            order[position],
                            order[position - 1],
                          ];
                          editShip({ ...currentShip, equipmentOrder: order });
                        }}
                      >
                        ↑
                      </button>
                      <button
                        disabled={index === pendingRecipes.length - 1}
                        onClick={() => {
                          const order = [...currentShip.equipmentOrder];
                          const position = order.indexOf(recipe.slot!);
                          [order[position + 1], order[position]] = [
                            order[position],
                            order[position + 1],
                          ];
                          editShip({ ...currentShip, equipmentOrder: order });
                        }}
                      >
                        ↓
                      </button>
                    </span>
                  )}
                  <Progress value={recipeProgress(recipe, data.inventory)} />
                  <div className="craft-action">
                    <small>{canCraft ? "재료가 모두 준비되었습니다. 제작 완료 시 공유 재고에서 차감합니다." : "모든 재료를 보유하면 제작 완료 처리를 할 수 있습니다."}</small>
                    <button className="primary" disabled={!canCraft} onClick={() => setCraftConfirm({ shipId: currentShip.id, recipeId: recipe.id })}>제작 완료</button>
                  </div>
                  <RecipeRows
                    recipe={recipe}
                    inventory={data.inventory}
                    setOwned={setOwned}
                    showSource={setSource}
                    data={data}
                    showSupply={setSupplyDetail}
                  />
                </article>
                );
              })}
              {completedCurrentRecipes.length > 0 && (
                <details className="completed-recipes" open>
                  <summary>완료한 제작 · {number(completedCurrentRecipes.length)}개</summary>
                  {completedCurrentRecipes.map((recipe) => {
                    const record = data.completedRecipes[craftRecordKey(currentShip.id, recipe.id)];
                    return <article className="recipe completed-recipe" key={recipe.id}>
                      <div><p>제작 완료 · {new Date(record.completedAt).toLocaleDateString("ko-KR")}</p><h3>{recipe.name}</h3><small>{Object.entries(record.consumedMaterials).map(([materialId, quantity]) => `${materialById[materialId]?.name || materialId} ${number(quantity)}개`).join(" · ")}</small></div>
                      <Progress value={100} />
                      <button className="craft-undo" onClick={() => undoCraft(currentShip, recipe.id)}>제작 완료 취소 · 재료 복구</button>
                    </article>;
                  })}
                </details>
              )}
            </>
          ) : (
            <p className="empty">선박을 선택하거나 함대를 추가하세요.</p>
          )}
        </section>
      )}
      {tab === "materials" && (
        <section>
          <div className="materials-view-tabs"><button className={materialsView === "inventory" ? "active" : ""} onClick={() => setMaterialsView("inventory")}>재료 현황</button><button className={materialsView === "barter" ? "active" : ""} onClick={() => setMaterialsView("barter")}>물교 우선순위</button></div>
          <div className="toolbar">
            <button
              className={scope === "all" ? "primary" : ""}
              onClick={() => setScope("all")}
            >
              남은 전체 목표
            </button>
            <button
              className={scope === "current" ? "primary" : ""}
              onClick={() => setScope("current")}
            >
              현재 단계만
            </button>
            {materialsView === "inventory" && <input
              placeholder="재료명 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />}
            <span className="save">
              {materialsView === "inventory" ? `정렬: ${data.materialSort.key} ${data.materialSort.direction === "asc" ? "↑" : "↓"}` : "물교 1회 절감 까주 우선"} · 단가 확인{" "}
              {priced}/{totals.length}종 · 부족분 {number(totalCrow)} 주화
            </span>
          </div>
          {materialsView === "inventory" ? <MaterialTable
            rows={orderedTotals.filter((x) => x.name.includes(query))}
            setOwned={setOwned}
            showSource={setSource}
            showSupply={setSupplyDetail}
            sort={data.materialSort}
            onSort={setMaterialSort}
          /> : <><BarterSessionControls session={data.barterSession} onChange={updateBarterSession} onReset={() => { if (confirm("이번 갱신 목록을 초기화할까요? 재고는 바뀌지 않습니다.")) updateBarterSession({ exchangeCounts: {} }); }} /><BarterPriorityTable rows={orderedBarterRows} sort={data.materialExchangeSort} onSort={setMaterialExchangeSort} showSource={setSource} session={data.barterSession} flashId={barterFlashId} onAdd={addBarterListing} onRemove={removeBarterListing} onComplete={completeBarter} /></>}
        </section>
      )}
      {tab === "daily" && (
        <section>
          <div className="section-title">
            <div>
              <p>활성화한 의뢰만 재료별 수급 예상에 반영합니다</p>
              <h2>내 일일·주간 수급 계획</h2>
            </div>
            <span className="save">
              재고는 변경하지 않습니다 · 선택 보상은 계획한 보상만 계산합니다
            </span>
          </div>
          <div className="location-quest-list">
            {locations.map((location) => {
              const locationTasks = dailyTasks.filter(
                (task) => task.startLocationId === location.id,
              );
              if (!locationTasks.length) return null;
              const locationRoutes = questRoutes.filter(
                (route) => route.startLocationId === location.id,
              );
              const routedQuestIds = new Set(
                locationRoutes.flatMap((route) =>
                  route.options.flatMap((option) => option.questIds),
                ),
              );
              const giverIds = [...new Set(locationTasks.map((task) => task.giverId || "unknown"))];
              return (
                <details className="location-quests" key={location.id} open>
                  <summary>
                    <span>{locationById[location.id].name}</span>
                    <small>Codex 확인 의뢰 {locationTasks.length}개</small>
                  </summary>
                  {giverIds.map((giverId) => {
                    const giverTasks = locationTasks.filter(
                      (task) => (task.giverId || "unknown") === giverId,
                    );
                    const giverRoutes = locationRoutes.filter(
                      (route) => (route.giverId || "unknown") === giverId,
                    );
                    const standalone = giverTasks.filter(
                      (task) => !routedQuestIds.has(task.id),
                    );
                    return (
                      <div className="giver-group" key={giverId}>
                        <h3>
                          {npcById[giverId]?.codexNpcId ? (
                            <a
                              href={codexNpcUrl(npcById[giverId].codexNpcId!)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {npcById[giverId].name}
                            </a>
                          ) : (
                            npcById[giverId]?.name || "수령 NPC 확인 필요"
                          )}
                          <small> 의뢰 수령 NPC · BDO Codex</small>
                        </h3>
                        {giverRoutes.map((route) => {
                          const routePlan = data.supplyPlans[`route:${route.id}`];
                          const selectedOption = route.options.find((option) =>
                            routePlan?.choiceId
                              ? option.id === routePlan.choiceId
                              : option.questIds.some(
                                  (questId) => data.supplyPlans[questId]?.enabled,
                                ),
                          );
                          return (
                            <div className="route-picker" key={route.id} data-route-id={route.id}>
                              <div>
                                <b>{route.name}</b>
                                <p>{route.description}</p>
                              </div>
                              <div className="route-options">
                                {route.options.map((option) => (
                                  <button
                                    key={option.id}
                                    className={selectedOption?.id === option.id ? "primary" : ""}
                                    onClick={() => chooseRoute(route, option.id)}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                              {selectedOption && (
                                <div className="task-grid route-task-grid">
                                  {selectedOption.questIds.map((questId) => {
                                    const task = dailyTasks.find((item) => item.id === questId);
                                    return task ? <QuestPlanCard key={task.id} task={task} plan={data.supplyPlans[task.id]} onPlan={setSupplyPlan} routeManaged /> : null;
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {!!standalone.length && (
                          <div className="task-grid">
                            {standalone.map((task) => <QuestPlanCard key={task.id} task={task} plan={data.supplyPlans[task.id]} onPlan={setSupplyPlan} />)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </details>
              );
            })}
          </div>
          <div className="section-title manual-title">
            <div>
              <p>의뢰 보상과 별도로, 현재 보유량에 더합니다</p>
              <h2>재료 단위 수동 추가</h2>
            </div>
          </div>
          <div className="manual-grid">
            {materials.map((item) => {
              const total = allTotals.find((x) => x.id === item.id);
              const owned = clamp(data.inventory[item.id]);
              return (
                <div className="manual-row" key={item.id}>
                  <b>{item.name}</b>
                  <span>
                    보유 {number(owned)} · 부족 {number(total?.shortage || 0)}
                  </span>
                  <input
                    className="num"
                    type="number"
                    min="0"
                    placeholder="추가 수량"
                    value={manualAdds[item.id] || ""}
                    onChange={(e) =>
                      setManualAdds({
                        ...manualAdds,
                        [item.id]: e.target.value,
                      })
                    }
                  />
                  <button onClick={() => addManual(item.id)}>+ 추가</button>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {tab === "guide" && (
        <section>
          <div className="toolbar">
            <input
              placeholder="재료명 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="save">고정 게임 데이터 · 편집 불가</span>
          </div>
          <div className="guide-grid">
            {materials
              .filter((x) => x.name.includes(query))
              .map((x) => (
                <article className="guide-card" key={x.id}>
                  <h3>{x.name}</h3>
                  <b>
                    {x.crowCoinPrice === undefined
                      ? "까마귀 주화 단가 미확인"
                      : `${number(x.crowCoinPrice)} 까마귀 주화 / 개`}
                  </b>
                  <ul>
                    {x.sources.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </article>
              ))}
          </div>
        </section>
      )}
      {tab === "settings" && (
        <section className="settings">
          <div className="panel">
            <h2>내 함대</h2>
            <p>
              게임 제작식은 고정입니다. 선박 이름, 종류, 현재 진행 단계와 보유
              수량만 관리합니다.
            </p>
            {data.ships.map((ship) => (
              <div className="ship-edit" key={ship.id}>
                <input
                  value={ship.name}
                  onChange={(e) => editShip({ ...ship, name: e.target.value })}
                />
                <select
                  value={ship.hull}
                  onChange={(e) => {
                    const hull = e.target.value as Hull;
                    editShip({
                      ...ship,
                      hull,
                      activeStage:
                        hull === "trade" || hull === "warship" ? 1 : 3,
                      upgradeHull:
                        hull === "trade" || hull === "warship"
                          ? defaultUpgradeHull[hull]
                          : undefined,
                      equipmentOrder: [...defaultEquipmentOrder[hull]],
                    });
                  }}
                >
                  {(Object.keys(hullLabel) as Hull[]).map((h) => (
                    <option value={h} key={h}>
                      {hullLabel[h]}
                    </option>
                  ))}
                </select>
                <button className="danger" onClick={() => removeShip(ship)}>
                  제거
                </button>
              </div>
            ))}
            <div className="add-ships">
              {(
                [
                  "trade",
                  "warship",
                  "balance",
                  "advance",
                  "volante",
                  "valor",
                ] as Hull[]
              ).map((h) => (
                <button
                  key={h}
                  onClick={() => {
                    const ship = newShip(h);
                    update({ ...data, ships: [...data.ships, ship] });
                    setSelected(ship.id);
                  }}
                >
                  + {hullLabel[h]}
                </button>
              ))}
            </div>
          </div>
          <div className="panel manage">
            <h2>Google Drive 동기화</h2>
            <p>
              제공된 OAuth Client ID로만 연결합니다. 진행 데이터만 앱 전용 Drive
              저장소에 동기화합니다.
            </p>
            {drive.status === "disconnected" ? (
              <button className="primary" onClick={drive.authorize}>
                Google Drive 연결
              </button>
            ) : (
              <button onClick={drive.disconnect}>Drive 연결 해제</button>
            )}
            {drive.error && <p className="sync-error">{drive.error}</p>}
          </div>
          <div className="panel manage">
            <h2>진행 데이터 백업</h2>
            <p>
              함대 구성과 공유 재고만 백업합니다. 게임 레시피는 앱에 고정되어
              있습니다.
            </p>
            <button onClick={exportData}>JSON 내보내기</button>
            <button onClick={() => importRef.current?.click()}>
              JSON 가져오기
            </button>
            <input
              hidden
              ref={importRef}
              type="file"
              accept="application/json"
              onChange={importData}
            />
            <button onClick={() => update(freshSample())}>
              샘플 진행 복원
            </button>
            <button
              className="danger"
              onClick={() => {
                if (confirm("현재 브라우저 진행 데이터를 초기화할까요?")) {
                  clearData();
                  update(freshSample());
                }
              }}
            >
              로컬 데이터 초기화
            </button>
          </div>
        </section>
      )}
      {craftConfirm && (() => {
        const ship = data.ships.find((item) => item.id === craftConfirm.shipId);
        const recipe = ship && shipRecipes(ship).find((item) => item.id === craftConfirm.recipeId);
        if (!ship || !recipe) return null;
        return <div className="modal"><div className="craft-confirm">
          <h2>{recipe.name} 제작 완료</h2>
          <p>아래 재료가 함대 전체의 공유 재고에서 차감됩니다. 완료 후 전체 재료·물교 우선순위도 즉시 다시 계산됩니다.</p>
          <ul>{recipe.requirements.map((requirement) => <li key={requirement.materialId}><b>{materialById[requirement.materialId].name}</b><span>{number(requirement.quantity)}개 차감 · 남음 {number(clamp(data.inventory[requirement.materialId]) - requirement.quantity)}개</span></li>)}</ul>
          <button onClick={() => setCraftConfirm(null)}>취소</button>
          <button className="primary" onClick={completeCraft}>재료 차감 후 완료</button>
        </div></div>;
      })()}
      {source && (
        <div className="modal">
          <div>
            <h2>{materialById[source].name} · 획득처</h2>
            <p>
              까마귀 주화 단가:{" "}
              {materialById[source].crowCoinPrice === undefined
                ? "확인 필요"
                : `${number(materialById[source].crowCoinPrice!)}개 / 1개`}
            </p>
            <ul>
              {materialById[source].sources.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <button onClick={() => setSource(null)}>닫기</button>
          </div>
        </div>
      )}
      {supplyDetail && (() => {
        const material = materialById[supplyDetail.materialId];
        const supply = materialSupply(data, material.id);
        const sources = supplyDetail.period === "daily" ? supply.dailySources : supply.weeklySources;
        const total = supplyDetail.period === "daily" ? supply.daily : supply.weekly;
        return (
          <div className="modal">
            <div>
              <h2>{material.name} · {supplyDetail.period === "daily" ? "일일" : "주간"} 수급</h2>
              <p>
                현재 수급 계획 합계: <b>{number(total)}개 / {supplyDetail.period === "daily" ? "일" : "주"}</b>
              </p>
              {sources.length ? (
                <ul className="supply-source-list">
                  {sources.map((entry) => (
                    <li key={entry.taskId}>
                      <b>{entry.taskName}</b>
                      <span>+{number(entry.quantity)}개 / {entry.period === "daily" ? "일" : "주"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>수급 예정으로 설정한 {supplyDetail.period === "daily" ? "일일" : "주간"} 의뢰가 없습니다.</p>
              )}
              <button onClick={() => setSupplyDetail(null)}>닫기</button>
            </div>
          </div>
        );
      })()}
      {drive.conflict && (
        <div className="modal">
          <div>
            <h2>Drive와 로컬 데이터가 다릅니다</h2>
            <p>
              더 최신인 쪽:{" "}
              <b>{drive.conflict.newer === "drive" ? "Drive" : "로컬"}</b>.
              선택한 데이터가 반대쪽을 덮어씁니다.
            </p>
            <button onClick={() => drive.resolveConflict("drive")}>
              Drive 사용
            </button>
            <button onClick={() => drive.resolveConflict("local")}>
              로컬 사용
            </button>
          </div>
        </div>
      )}
      {barterToast && <div className="barter-toast" role="status">{materialById[barterToast.materialId].name} 재고 {number(barterToast.quantity)}개 추가됨</div>}
    </main>
  );
}
function QuestPlanCard({
  task,
  plan,
  onPlan,
  routeManaged = false,
}: {
  task: DailyTask;
  plan?: SupplyPlan;
  onPlan: (task: DailyTask, patch: { enabled?: boolean; choiceId?: string }) => void;
  routeManaged?: boolean;
}) {
  return (
    <article className={`task-card ${plan?.enabled ? "planned" : ""}`} data-quest-id={task.codexQuestId}>
      <span className={`period ${task.period}`}>{task.period === "daily" ? "일일" : "주간"}</span>
      <h3>{task.name}</h3>
      <p>{task.objective || task.note}</p>
      <small className="quest-meta">
        {task.codexQuestId} · <a href={task.codexQuestId ? codexQuestUrl(task.codexQuestId) : undefined} target="_blank" rel="noreferrer">BDO Codex</a>
      </small>
      <div className="rewards">
        {task.rewards.map((reward) => (
          <span key={reward.materialId}>+{number(reward.quantity)} {materialById[reward.materialId].name}</span>
        ))}
      </div>
      {task.choices && (
        <label className="quest-choice">
          선택 보상
          <select value={plan?.choiceId || ""} onChange={(event) => onPlan(task, { choiceId: event.target.value })}>
            <option value="">선택하세요</option>
            {task.choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label} · {choice.rewards.map((reward) => `${number(reward.quantity)} ${materialById[reward.materialId].name}`).join(", ")}
              </option>
            ))}
          </select>
        </label>
      )}
      {routeManaged && <small>위에서 수행 루트를 고른 뒤, 이 의뢰를 수급 계획에 따로 포함할 수 있습니다.</small>}
      <button className={plan?.enabled ? "planned-button" : "primary"} onClick={() => onPlan(task, { enabled: !plan?.enabled })}>
        {plan?.enabled ? "수급 계획에서 제외" : "수급 계획에 포함"}
      </button>
      <small>{plan?.enabled ? task.choices && !plan?.choiceId ? "기본 보상만 계산 중입니다. 선택 보상도 지정하세요." : "재료별 일일·주간 수급량과 완료 예상에 반영됩니다." : "재고에는 영향을 주지 않으며, 수급 예상에도 포함되지 않습니다."}</small>
    </article>
  );
}
function RecipeRows({
  recipe,
  inventory,
  setOwned,
  showSource,
  data,
  showSupply,
}: {
  recipe: (typeof recipes)[number];
  inventory: Record<string, number>;
  setOwned: (id: string, n: number) => void;
  showSource: (id: string) => void;
  data: AppData;
  showSupply: (detail: { materialId: string; period: "daily" | "weekly" }) => void;
}) {
  return (
    <div className="recipe-rows">
      <div className="recipe-row-head">
        <span>재료</span><span>필요</span><span>보유</span><span>부족</span><span>진행률</span><span>일일 수급</span><span>주간 수급</span><span>완료까지</span><span>부족분 주화</span>
      </div>
      {recipe.requirements.map((req) => {
        const m = materialById[req.materialId];
        const owned = clamp(inventory[req.materialId]);
        const short = Math.max(0, req.quantity - owned);
        const supply = materialSupply(data, m.id);
        const days = short === 0 ? 0 : supply.daily + supply.weekly / 7 > 0 ? Math.ceil(short / (supply.daily + supply.weekly / 7)) : undefined;
        return (
          <div key={req.materialId}>
            <button className="link-button" onClick={() => showSource(m.id)}>
              {m.name}
            </button>
            <span>필요 {number(req.quantity)}</span>
            <Num value={owned} onChange={(v) => setOwned(m.id, v)} />
            <em>{short ? `부족 ${number(short)}` : "완료"}</em>
            <Progress
              value={Math.min(100, Math.round((owned / req.quantity) * 100))}
            />
            <button className="supply-cell" onClick={() => showSupply({ materialId: m.id, period: "daily" })}>
              일 {number(supply.daily)}
            </button>
            <button className="supply-cell" onClick={() => showSupply({ materialId: m.id, period: "weekly" })}>
              주 {number(supply.weekly)}
            </button>
            <b className={days === undefined && short > 0 ? "no-plan" : ""}>
              {short === 0 ? "완료" : days === undefined ? "계획 없음" : `약 ${number(days)}일`}
            </b>
            <b>
              {m.crowCoinPrice === undefined
                ? "—"
                : `${number(short * m.crowCoinPrice)} 주화`}
            </b>
          </div>
        );
      })}
    </div>
  );
}
function MaterialTable({
  rows,
  setOwned,
  showSource,
  showSupply,
  sort,
  onSort,
}: {
  rows: ReturnType<typeof aggregate>;
  setOwned: (id: string, n: number) => void;
  showSource: (id: string) => void;
  showSupply: (detail: { materialId: string; period: "daily" | "weekly" }) => void;
  sort: { key: MaterialSortKey; direction: "asc" | "desc" };
  onSort: (key: MaterialSortKey) => void;
}) {
  const header = (label: string, key: MaterialSortKey) => (
    <th>
      <button className="sort-button" onClick={() => onSort(key)}>
        {label}
        {sort.key === key ? (sort.direction === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {header("재료", "name")}
            {header("필요", "required")}
            {header("보유", "owned")}
            {header("부족", "shortage")}
            {header("진행률", "progress")}
            {header("일일 수급", "dailySupply")}
            {header("주간 수급", "weeklySupply")}
            {header("수급 완료까지", "estimatedDays")}
            {header("까마귀 주화/개", "crowCoinPrice")}
            {header("부족분 주화", "crowCoinTotal")}
            {header("사용처", "recipes")}
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.id}>
              <td>
                <button
                  className="link-button"
                  onClick={() => showSource(x.id)}
                >
                  {x.name}
                </button>
              </td>
              <td>{number(x.required)}</td>
              <td>
                <Num value={x.owned} onChange={(v) => setOwned(x.id, v)} />
              </td>
              <td className={x.shortage ? "shortage" : ""}>
                {number(x.shortage)}
              </td>
              <td>
                <Progress value={x.progress} />
              </td>
              <td>
                <button className="supply-cell" onClick={() => showSupply({ materialId: x.id, period: "daily" })}>
                  {number(x.dailySupply)}
                </button>
              </td>
              <td>
                <button className="supply-cell" onClick={() => showSupply({ materialId: x.id, period: "weekly" })}>
                  {number(x.weeklySupply)}
                </button>
              </td>
              <td className={x.estimatedDays === undefined && x.shortage ? "no-plan" : ""}>
                {x.estimatedDays === undefined
                  ? x.shortage ? "계획 없음" : "완료"
                  : `약 ${number(x.estimatedDays)}일`}
              </td>
              <td>
                {x.crowCoinPrice === undefined ? "—" : number(x.crowCoinPrice)}
              </td>
              <td>
                {x.crowCoinTotal === undefined ? "—" : number(x.crowCoinTotal)}
              </td>
              <td>
                <small>
                  {x.recipes.slice(0, 2).join(", ")}
                  {x.recipes.length > 2 ? " 외" : ""}
                </small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function BarterSessionControls({ session, onChange, onReset }: { session: AppData["barterSession"]; onChange: (patch: Partial<AppData["barterSession"]>) => void; onReset: () => void }) {
  const totalExchanges = Object.values(session.exchangeCounts).reduce((sum, count) => sum + count, 0); const needed = totalExchanges * session.costPerExchange;
  return <div className="barter-session"><div><b>현재 재료 갱신</b><small>좌클릭 +1 · 우클릭 -1 · 실제 교환 후 우측 완료 버튼을 누르세요.</small></div><label>회당 필요 교섭력<Num value={session.costPerExchange} onChange={(costPerExchange) => onChange({ costPerExchange })} /></label><div className="barter-total"><small>총 필요 교섭력 · {number(totalExchanges)}회</small><b>{number(needed)}</b></div><label className="barter-check"><input type="checkbox" checked={session.addToInventory} onChange={(event) => onChange({ addToInventory: event.target.checked })} />완료 시 재고 반영</label><button onClick={onReset}>목록 초기화</button></div>;
}
function BarterPriorityTable({ rows, sort, onSort, showSource, session, flashId, onAdd, onRemove, onComplete }: { rows: BarterRow[]; sort: AppData["materialExchangeSort"]; onSort: (key: MaterialExchangeSortKey) => void; showSource: (id: string) => void; session: AppData["barterSession"]; flashId: string | null; onAdd: (row: BarterRow) => void; onRemove: (row: BarterRow) => void; onComplete: (row: BarterRow) => void }) {
  const header = (label: string, key: MaterialExchangeSortKey) => <th><button className="sort-button" onClick={() => onSort(key)}>{label}{sort.key === key ? (sort.direction === "asc" ? " ↑" : " ↓") : ""}</button></th>;
  return <div className="table-wrap"><table className="barter-table"><thead><tr>{header("추천", "priority")}{header("재료", "name")}{header("부족", "shortage")}{header("물교 비율", "outputQuantity")}{header("교환 후 부족", "afterExchangeShortage")}{header("진행률 증가", "progressGain")}{header("이번 물교 절감", "exchangeCrowValue")}{header("전량 구매 까주", "crowCoinTotal")}<th>이번 갱신</th></tr></thead><tbody>
    {rows.map((row, index) => { const count = session.exchangeCounts[row.id] || 0; return <tr key={row.id} className={`${count ? "barter-listed" : ""} ${flashId === row.id ? "barter-flash" : ""}`} onClick={() => onAdd(row)} onContextMenu={(event) => { event.preventDefault(); onRemove(row); }}><td><b className={index < 3 ? "barter-rank top" : "barter-rank"}>{index + 1}</b></td><td><button className="link-button" onClick={(event) => { event.stopPropagation(); showSource(row.id); }}>{row.name}</button><small className="barter-count">이번 갱신: {number(count)}회 교환 · 1회당 {number(row.outputQuantity)}개</small></td><td className="shortage">{number(row.shortage)}</td><td>1 : {number(row.outputQuantity)}{row.outputQuantity === 1 ? <small className="default-rate"> 기본</small> : ""}</td><td>{number(row.afterExchangeShortage)}</td><td>+{row.progressGain}%</td><td className={row.exchangeCrowValue === undefined ? "no-plan" : "barter-value"}>{row.exchangeCrowValue === undefined ? "단가 미확인" : `${number(row.exchangeCrowValue)} 주화`}</td><td>{row.crowCoinTotal === undefined ? "—" : `${number(row.crowCoinTotal)} 주화`}</td><td>{count ? <button className="primary barter-complete" onClick={(event) => { event.stopPropagation(); onComplete(row); }}>1회 거래 완료</button> : <small className="barter-pending">거래 지정 필요</small>}</td></tr>; })}
    {!rows.length && <tr><td colSpan={9} className="empty">현재 범위에 부족한 재료가 없습니다.</td></tr>}
  </tbody></table></div>;
}
