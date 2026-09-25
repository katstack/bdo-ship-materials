import { ChangeEvent, useMemo, useRef, useState } from "react";
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
import type { AppData, Hull, MaterialSortKey, Ship, Stage } from "./types";
import {
  aggregate,
  clamp,
  number,
  recipeProgress,
  shipRecipes,
  stageProgress,
} from "./utils";

type Tab = "dashboard" | "ship" | "materials" | "daily" | "guide" | "settings";
const id = () => crypto.randomUUID();
const koreaDay = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
const taskAvailable = (
  last: string | undefined,
  period: "daily" | "weekly",
) => {
  if (!last) return true;
  const elapsed = Math.floor(
    (Date.parse(`${koreaDay()}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) /
      86400000,
  );
  return period === "daily" ? last !== koreaDay() : elapsed >= 7;
};
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
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selected, setSelected] = useState(data.ships[0]?.id || "");
  const [scope, setScope] = useState<"current" | "all">("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [manualAdds, setManualAdds] = useState<Record<string, string>>({});
  const [questChoices, setQuestChoices] = useState<Record<string, string>>({});
  const importRef = useRef<HTMLInputElement>(null);
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
  const currentShip = data.ships.find((s) => s.id === selected);
  const currentRecipes = currentShip
    ? [...shipRecipes(currentShip)].sort(
        (a, b) =>
          (a.slot ? currentShip.equipmentOrder.indexOf(a.slot) : 99) -
          (b.slot ? currentShip.equipmentOrder.indexOf(b.slot) : 99),
      )
    : [];
  const totalCrow = totals.reduce((s, x) => s + (x.crowCoinTotal || 0), 0);
  const priced = totals.filter((x) => x.crowCoinPrice !== undefined).length;
  const setOwned = (materialId: string, value: number) =>
    update({ ...data, inventory: { ...data.inventory, [materialId]: value } });
  const claimTask = (task: (typeof dailyTasks)[number]) => {
    if (!taskAvailable(data.completedTasks[task.id], task.period)) return;
    const selectedChoice = task.choices?.find(
      (choice) => choice.id === questChoices[task.id],
    );
    if (task.choices && !selectedChoice) {
      setNotice("선택 보상을 고른 뒤 수령 처리하세요.");
      return;
    }
    const inventory = { ...data.inventory };
    [...task.rewards, ...(selectedChoice?.rewards || [])].forEach((reward) => {
      inventory[reward.materialId] =
        clamp(inventory[reward.materialId]) + reward.quantity;
    });
    update({
      ...data,
      inventory,
      completedTasks: { ...data.completedTasks, [task.id]: koreaDay() },
    });
    setNotice(`${task.name} 보상을 공유 재고에 추가했습니다.`);
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
              {currentRecipes.map((recipe, index) => (
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
                        disabled={index === currentRecipes.length - 1}
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
                  <RecipeRows
                    recipe={recipe}
                    inventory={data.inventory}
                    setOwned={setOwned}
                    showSource={setSource}
                  />
                </article>
              ))}
            </>
          ) : (
            <p className="empty">선박을 선택하거나 함대를 추가하세요.</p>
          )}
        </section>
      )}
      {tab === "materials" && (
        <section>
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
            <input
              placeholder="재료명 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="save">
              정렬: {data.materialSort.key}{" "}
              {data.materialSort.direction === "asc" ? "↑" : "↓"} · 단가 확인{" "}
              {priced}/{totals.length}종 · 부족분 {number(totalCrow)} 주화
            </span>
          </div>
          <MaterialTable
            rows={orderedTotals.filter((x) => x.name.includes(query))}
            setOwned={setOwned}
            showSource={setSource}
            sort={data.materialSort}
            onSort={setMaterialSort}
          />
        </section>
      )}
      {tab === "daily" && (
        <section>
          <div className="section-title">
            <div>
              <p>체크한 보상은 공유 재고에 즉시 누적됩니다</p>
              <h2>일일·주간 수급</h2>
            </div>
            <span className="save">
              한국 시간 기준 · 예상 일수는 모든 등록 수급처를 매번 완료한다고
              가정
            </span>
          </div>
          <div className="task-grid">
            {dailyTasks.map((task) => {
              const available = taskAvailable(
                data.completedTasks[task.id],
                task.period,
              );
              const selectedChoice = task.choices?.find(
                (choice) => choice.id === questChoices[task.id],
              );
              return (
                <article className="task-card" key={task.id}>
                  <span className={`period ${task.period}`}>
                    {task.period === "daily" ? "일일" : "주간"}
                  </span>
                  <h3>{task.name}</h3>
                  <p>{task.note}</p>
                  <div className="rewards">
                    {task.rewards.map((reward) => (
                      <span key={reward.materialId}>
                        +{number(reward.quantity)}{" "}
                        {materialById[reward.materialId].name}
                      </span>
                    ))}
                    {task.otherRewards?.map((reward) => (
                      <span className="info-reward" key={reward}>
                        {reward}
                      </span>
                    ))}
                  </div>
                  {task.choices && (
                    <label className="quest-choice">
                      선택 보상
                      <select
                        value={questChoices[task.id] || ""}
                        onChange={(event) =>
                          setQuestChoices({
                            ...questChoices,
                            [task.id]: event.target.value,
                          })
                        }
                      >
                        <option value="">선택하세요</option>
                        {task.choices.map((choice) => (
                          <option key={choice.id} value={choice.id}>
                            {choice.label} · {choice.rewards
                              .map(
                                (reward) =>
                                  `${number(reward.quantity)} ${materialById[reward.materialId].name}`,
                              )
                              .join(", ")}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    className={available ? "primary" : ""}
                    disabled={!available || (!!task.choices && !selectedChoice)}
                    onClick={() => claimTask(task)}
                  >
                    {available
                      ? `${task.period === "daily" ? "오늘" : "이번 주"} 수령 처리`
                      : "처리 완료"}
                  </button>
                  <small>
                    {available
                      ? task.choices && !selectedChoice
                        ? "선택 보상을 고르면 수령 처리할 수 있습니다."
                        : "체크하면 재료가 자동으로 더해집니다."
                      : `${data.completedTasks[task.id]}에 처리됨`}
                  </small>
                </article>
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
    </main>
  );
}
function RecipeRows({
  recipe,
  inventory,
  setOwned,
  showSource,
}: {
  recipe: (typeof recipes)[number];
  inventory: Record<string, number>;
  setOwned: (id: string, n: number) => void;
  showSource: (id: string) => void;
}) {
  return (
    <div className="recipe-rows">
      {recipe.requirements.map((req) => {
        const m = materialById[req.materialId];
        const owned = clamp(inventory[req.materialId]);
        const short = Math.max(0, req.quantity - owned);
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
  sort,
  onSort,
}: {
  rows: ReturnType<typeof aggregate>;
  setOwned: (id: string, n: number) => void;
  showSource: (id: string) => void;
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
            {header("예상 일수", "estimatedDays")}
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
                {x.estimatedDays === undefined
                  ? "—"
                  : `${number(x.estimatedDays)}일`}
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
