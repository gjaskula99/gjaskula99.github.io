(() => {
  "use strict";

  const STORAGE_KEY = "porzadekObrad.plan.v1";
  const PLAN_VERSION = 1;
  const MINUTE = 60 * 1000;

  const elements = {
    titleInput: document.getElementById("titleInput"),
    plannedStartInput: document.getElementById("plannedStartInput"),
    localClock: document.getElementById("localClock"),
    stickyTitle: document.querySelector(".sticky-title"),
    stickyTitleText: document.getElementById("stickyTitleText"),
    stickyClock: document.getElementById("stickyClock"),
    editActions: document.getElementById("editActions"),
    addRootButton: document.getElementById("addRootButton"),
    addChildButton: document.getElementById("addChildButton"),
    markWaitingButton: document.getElementById("markWaitingButton"),
    toggleStrikeButton: document.getElementById("toggleStrikeButton"),
    deleteButton: document.getElementById("deleteButton"),
    clearAgendaButton: document.getElementById("clearAgendaButton"),
    moveUpButton: document.getElementById("moveUpButton"),
    moveDownButton: document.getElementById("moveDownButton"),
    promoteButton: document.getElementById("promoteButton"),
    demoteButton: document.getElementById("demoteButton"),
    agendaBody: document.getElementById("agendaBody"),
    emptyState: document.getElementById("emptyState"),
    activeItemLabel: document.getElementById("activeItemLabel"),
    activeItemCountdown: document.getElementById("activeItemCountdown"),
    currentDelay: document.getElementById("currentDelay"),
    projectedEnd: document.getElementById("projectedEnd"),
    previousButton: document.getElementById("previousButton"),
    activateButton: document.getElementById("activateButton"),
    nextButton: document.getElementById("nextButton"),
    timerMinutes: document.getElementById("timerMinutes"),
    timerSeconds: document.getElementById("timerSeconds"),
    timerDisplay: document.getElementById("timerDisplay"),
    timerBox: document.getElementById("timerBox"),
    timerToggleButton: document.getElementById("timerToggleButton"),
    timerResetButton: document.getElementById("timerResetButton"),
    editModeButton: document.getElementById("editModeButton"),
    exportButton: document.getElementById("exportButton"),
    importButton: document.getElementById("importButton"),
    printButton: document.getElementById("printButton"),
    importInput: document.getElementById("importInput"),
    messageBar: document.getElementById("messageBar"),
  };

  let state = loadPlan();
  let selectedItemId = state.activeItemId || firstItemId(state.items);
  let editMode = false;
  let lastAgendaRows = [];
  let messageTimeout = null;
  let timer = {
    running: false,
    alarmActive: false,
    remainingSeconds: 60,
    deadline: null,
    intervalId: null,
  };
  let audioContext = null;

  function createDefaultPlan() {
    return {
      version: PLAN_VERSION,
      title: "Plan spotkania",
      plannedStartTime: "09:00",
      activeItemId: null,
      items: [
        createItem({
          text: "Otwarcie spotkania i potwierdzenie agendy",
          durationMinutes: 10,
          sortOrder: 1,
        }),
        createItem({
          text: "Omówienie spraw bieżących",
          durationMinutes: 20,
          sortOrder: 2,
        }),
        createItem({
          text: "Decyzje i działania do wykonania",
          durationMinutes: 15,
          sortOrder: 3,
        }),
      ],
    };
  }

  function createItem(overrides = {}) {
    return {
      id: overrides.id || createId(),
      parentId: overrides.parentId || null,
      text: overrides.text || "Nowy punkt",
      durationMinutes: Number.isFinite(overrides.durationMinutes) ? overrides.durationMinutes : 5,
      struck: Boolean(overrides.struck),
      actualStartAt: overrides.actualStartAt || null,
      actualEndAt: overrides.actualEndAt || null,
      flowStatus: normalizeFlowStatus(overrides.flowStatus),
      sortOrder: Number.isFinite(overrides.sortOrder) ? overrides.sortOrder : Date.now(),
    };
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function loadPlan() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return createDefaultPlan();
    }

    try {
      const parsed = JSON.parse(saved);
      const validation = validatePlan(parsed);
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      return normalizePlan(parsed);
    } catch (error) {
      console.warn("Nie można wczytać planu z localStorage:", error);
      return createDefaultPlan();
    }
  }

  function savePlan() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function validatePlan(plan) {
    if (!plan || typeof plan !== "object") {
      return { valid: false, message: "Plik nie zawiera obiektu planu." };
    }
    if (plan.version !== PLAN_VERSION) {
      return { valid: false, message: `Obsługiwana wersja planu to ${PLAN_VERSION}.` };
    }
    if (!Array.isArray(plan.items)) {
      return { valid: false, message: "Brakuje listy punktów obrad." };
    }
    const ids = new Set();
    for (const item of plan.items) {
      if (!item || typeof item !== "object") {
        return { valid: false, message: "Jeden z punktów ma nieprawidłowy format." };
      }
      if (typeof item.id !== "string" || !item.id.trim()) {
        return { valid: false, message: "Każdy punkt musi mieć identyfikator." };
      }
      if (ids.has(item.id)) {
        return { valid: false, message: "Identyfikatory punktów muszą być unikalne." };
      }
      ids.add(item.id);
      if (typeof item.text !== "string") {
        return { valid: false, message: "Każdy punkt musi mieć opis tekstowy." };
      }
      if (!Number.isFinite(Number(item.durationMinutes)) || Number(item.durationMinutes) < 0) {
        return { valid: false, message: "Czas punktu musi być liczbą nieujemną." };
      }
    }
    return { valid: true };
  }

  function normalizePlan(plan) {
    const ids = new Set(plan.items.map((item) => item.id));
    return {
      version: PLAN_VERSION,
      title: typeof plan.title === "string" && plan.title.trim() ? plan.title : "Plan spotkania",
      plannedStartTime: isTimeValue(plan.plannedStartTime) ? plan.plannedStartTime : "09:00",
      activeItemId: ids.has(plan.activeItemId) ? plan.activeItemId : null,
      items: plan.items.map((item, index) => {
        const durationMinutes = Math.max(0, Number(item.durationMinutes) || 0);
        const actualStartAt = isDateValue(item.actualStartAt) ? item.actualStartAt : null;
        const actualEndAt =
          isDateValue(item.actualEndAt) && actualStartAt
            ? calculateEndIsoFromValues(actualStartAt, durationMinutes)
            : null;

        return createItem({
          id: item.id,
          parentId: ids.has(item.parentId) ? item.parentId : null,
          text: item.text,
          durationMinutes,
          struck: Boolean(item.struck),
          actualStartAt,
          actualEndAt,
          flowStatus: normalizeFlowStatus(item.flowStatus),
          sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index + 1,
        });
      }),
    };
  }

  function normalizeFlowStatus(value) {
    return value === "restored" || value === "deferred" ? value : null;
  }

  function isTimeValue(value) {
    return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  function isDateValue(value) {
    return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
  }

  function calculateEndIsoFromValues(actualStartAt, durationMinutes) {
    const start = new Date(actualStartAt).getTime();
    if (Number.isNaN(start)) {
      return null;
    }
    return new Date(start + Math.max(0, Number(durationMinutes) || 0) * MINUTE).toISOString();
  }

  function calculatedEndForItem(item) {
    const endIso = calculateEndIsoFromValues(item.actualStartAt, item.durationMinutes);
    return endIso ? new Date(endIso) : null;
  }

  function firstItemId(items) {
    return buildAgenda(items).rows[0]?.item.id || null;
  }

  function buildAgenda(items) {
    const childrenByParent = new Map();
    for (const item of items) {
      const key = item.parentId || "__root__";
      if (!childrenByParent.has(key)) {
        childrenByParent.set(key, []);
      }
      childrenByParent.get(key).push(item);
    }

    for (const children of childrenByParent.values()) {
      children.sort((a, b) => a.sortOrder - b.sortOrder || a.text.localeCompare(b.text, "pl"));
    }

    const rows = [];
    let cursor = plannedStartDate().getTime();

    function walk(parentId, prefix, depth) {
      const children = childrenByParent.get(parentId || "__root__") || [];
      children.forEach((item, index) => {
        const number = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
        const durationMs = Math.max(0, Number(item.durationMinutes) || 0) * MINUTE;
        const plannedStart = item.struck ? null : new Date(cursor);
        const plannedEnd = item.struck ? null : new Date(cursor + durationMs);
        rows.push({
          item,
          number,
          depth,
          plannedStart,
          plannedEnd,
          durationMs,
        });
        if (!item.struck) {
          cursor += durationMs;
        }
        walk(item.id, number, depth + 1);
      });
    }

    walk(null, "", 0);

    return {
      rows,
      plannedEnd: new Date(cursor),
    };
  }

  function plannedStartDate() {
    const [hour, minute] = (isTimeValue(state.plannedStartTime) ? state.plannedStartTime : "09:00")
      .split(":")
      .map(Number);
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date;
  }

  function render() {
    elements.titleInput.value = state.title;
    elements.titleInput.readOnly = !editMode;
    elements.titleInput.setAttribute("aria-readonly", String(!editMode));
    elements.stickyTitleText.textContent = state.title;
    elements.plannedStartInput.value = state.plannedStartTime;
    elements.plannedStartInput.disabled = !editMode;
    elements.plannedStartInput.setAttribute("aria-disabled", String(!editMode));
    elements.editActions.hidden = !editMode;
    document.body.classList.toggle("editing", editMode);
    elements.editModeButton.textContent = editMode ? "Zamknij" : "Edytuj";

    const agenda = buildAgenda(state.items);
    lastAgendaRows = agenda.rows;
    elements.emptyState.hidden = agenda.rows.length > 0;
    elements.agendaBody.innerHTML = agenda.rows.map(renderRow).join("");
    updateStatus();
  }

  function renderRow(row) {
    const { item } = row;
    const isSelected = selectedItemId === item.id;
    const isActive = state.activeItemId === item.id;
    const rowClasses = [
      isSelected ? "selected" : "",
      isActive ? "active" : "",
      item.struck ? "struck" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const delay = computeDelay(row, new Date());
    const depthSpace = `${Math.min(row.depth * 22, 110)}px`;

    return `
      <tr class="${rowClasses}" data-id="${escapeAttr(item.id)}">
        <td class="number-cell">${escapeHtml(row.number)}</td>
        <td class="item-cell">
          <div class="item-content">
            <span class="depth-marker" style="--depth-space: ${depthSpace}"></span>
            ${editMode ? renderTextInput(item) : `<span class="item-text">${escapeHtml(item.text)}</span>`}
          </div>
        </td>
        <td class="time-cell">${formatTime(row.plannedStart)}</td>
        <td class="duration-cell">${editMode ? renderDurationInput(item) : `${item.durationMinutes} min`}</td>
        <td class="time-cell">${formatTimeValue(item.actualStartAt)}</td>
        <td class="time-cell">${formatActualEnd(item)}</td>
        <td class="delay-cell ${delay.className}">${delay.label}</td>
        <td>${renderStatus(row)}</td>
      </tr>
    `;
  }

  function renderTextInput(item) {
    return `<input class="edit-text-input" data-field="text" data-id="${escapeAttr(item.id)}" type="text" value="${escapeAttr(item.text)}">`;
  }

  function renderDurationInput(item) {
    return `<input class="edit-duration-input" data-field="durationMinutes" data-id="${escapeAttr(item.id)}" type="number" min="0" step="1" value="${escapeAttr(String(item.durationMinutes))}" aria-label="Czas w minutach"> min`;
  }

  function formatActualEnd(item) {
    if (!item.actualStartAt) {
      return "";
    }
    return formatTime(calculatedEndForItem(item));
  }

  function renderStatus(row) {
    const { item } = row;
    if (item.struck) {
      return `<span class="status-badge struck">Wykreślony</span>`;
    }
    if (item.flowStatus === "deferred") {
      return `<span class="status-badge deferred">Odroczony</span>`;
    }
    if (item.flowStatus === "restored") {
      return `<span class="status-badge restored">Przywrócony</span>`;
    }
    if (state.activeItemId === item.id) {
      return `<span class="status-badge active">W toku</span>`;
    }
    if (item.actualEndAt) {
      return `<span class="status-badge done">Zakończony</span>`;
    }
    if (item.actualStartAt) {
      return `<span class="status-badge">Rozpoczęty</span>`;
    }
    return `<span class="status-badge">Oczekuje</span>`;
  }

  function updateStatus() {
    const now = new Date();
    const localTime = formatClock(now);
    elements.localClock.textContent = localTime;
    elements.stickyClock.textContent = localTime;

    const agenda = buildAgenda(state.items);
    lastAgendaRows = agenda.rows;
    const activeRow = agenda.rows.find((row) => row.item.id === state.activeItemId);
    const selectedRow = agenda.rows.find((row) => row.item.id === selectedItemId);

    elements.addChildButton.disabled = !selectedRow;
    elements.markWaitingButton.disabled = !selectedRow;
    elements.toggleStrikeButton.disabled = !selectedRow;
    elements.toggleStrikeButton.textContent = selectedRow?.item.struck ? "Przywróć" : "Wykreśl";
    elements.deleteButton.disabled = !selectedRow;
    elements.clearAgendaButton.disabled = state.items.length === 0;
    elements.moveUpButton.disabled = !canMoveSelected(-1);
    elements.moveDownButton.disabled = !canMoveSelected(1);
    elements.promoteButton.disabled = !canPromoteSelected();
    elements.demoteButton.disabled = !canDemoteSelected();
    elements.activateButton.disabled = !selectedRow || Boolean(selectedRow.item.struck);
    elements.previousButton.disabled = navigableRows().length === 0;
    elements.nextButton.disabled = navigableRows().length === 0;

    if (!activeRow) {
      elements.activeItemLabel.textContent = "Brak";
      elements.activeItemCountdown.textContent = "Brak";
      elements.activeItemCountdown.className = "active-countdown";
      elements.currentDelay.textContent = "Brak";
      elements.currentDelay.className = "";
      elements.projectedEnd.textContent = formatTime(agenda.plannedEnd);
      return;
    }

    const delay = computeDelay(activeRow, now);
    const activeCountdown = computeActiveCountdown(activeRow, now);
    elements.activeItemLabel.textContent = `${activeRow.number}. ${activeRow.item.text}`;
    elements.activeItemCountdown.textContent = activeCountdown.label;
    elements.activeItemCountdown.className = `active-countdown ${activeCountdown.className}`.trim();
    elements.currentDelay.textContent = delay.label;
    elements.currentDelay.className = delay.className;
    elements.projectedEnd.textContent = formatTime(projectedEndDate(agenda.rows, activeRow, now) || agenda.plannedEnd);
  }

  function computeActiveCountdown(row, now) {
    if (!row || !row.item.actualStartAt || row.item.struck) {
      return { label: "Brak", className: "" };
    }

    const start = new Date(row.item.actualStartAt).getTime();
    const remainingMs = row.durationMs - Math.max(0, now.getTime() - start);
    if (remainingMs >= 0) {
      return {
        label: formatDuration(Math.ceil(remainingMs / 1000)),
        className: "positive",
      };
    }

    return {
      label: `+${formatDuration(Math.ceil(Math.abs(remainingMs) / 1000))}`,
      className: "negative",
    };
  }

  function navigableRows() {
    return lastAgendaRows.filter((row) => !row.item.struck);
  }

  function projectedEndDate(rows, activeRow, now) {
    if (!activeRow || activeRow.item.struck) {
      return null;
    }

    const activeIndex = rows.findIndex((row) => row.item.id === activeRow.item.id);
    if (activeIndex < 0) {
      return null;
    }

    const activeStart = activeRow.item.actualStartAt ? new Date(activeRow.item.actualStartAt).getTime() : now.getTime();
    const elapsedActive = Math.max(0, now.getTime() - activeStart);
    let remainingMs = Math.max(0, activeRow.durationMs - elapsedActive);

    for (const row of rows.slice(activeIndex + 1)) {
      if (!row.item.struck) {
        remainingMs += row.durationMs;
      }
    }

    return new Date(now.getTime() + remainingMs);
  }

  function computeDelay(row, now) {
    if (!row || row.item.struck || !row.plannedStart || !row.item.actualStartAt) {
      return { label: "—", className: "" };
    }

    let diff = null;
    const calculatedEnd = calculatedEndForItem(row.item);
    if (state.activeItemId === row.item.id) {
      diff = row.plannedEnd ? now.getTime() - row.plannedEnd.getTime() : null;
    } else if (calculatedEnd && row.plannedEnd) {
      diff = calculatedEnd.getTime() - row.plannedEnd.getTime();
    }

    if (diff === null) {
      return { label: "—", className: "" };
    }

    return {
      label: formatDelta(diff),
      className: diff > 0 ? "delay-positive" : diff < 0 ? "delay-negative" : "",
    };
  }

  function activateSelected() {
    if (!selectedItemId) {
      showMessage("Najpierw zaznacz punkt obrad.", true);
      return;
    }
    activateItem(selectedItemId);
  }

  function activateItem(itemId, options = {}) {
    const item = state.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      return;
    }
    if (item.struck) {
      showMessage("Wykreślony punkt trzeba najpierw przywrócić.", true);
      return;
    }

    const now = new Date().toISOString();
    const activeItem = state.items.find((candidate) => candidate.id === state.activeItemId);
    if (activeItem && activeItem.id !== item.id) {
      if (options.deferCurrent) {
        activeItem.flowStatus = "deferred";
        activeItem.actualEndAt = null;
      } else {
        if (!activeItem.actualEndAt) {
          activeItem.actualEndAt = calculateEndIsoFromValues(activeItem.actualStartAt, activeItem.durationMinutes) || now;
        }
        if (activeItem.flowStatus === "deferred") {
          activeItem.flowStatus = null;
        }
      }
    }

    if (!item.actualStartAt || options.restoreTarget || item.flowStatus === "deferred") {
      item.actualStartAt = now;
    }
    item.actualEndAt = null;
    item.flowStatus = options.restoreTarget ? "restored" : null;
    state.activeItemId = item.id;
    selectedItemId = item.id;
    savePlan();
    render();
    showMessage(`Aktywny punkt: ${item.text}`);
  }

  function activateRelative(direction) {
    const rows = navigableRows();
    if (!rows.length) {
      showMessage("Brak punktów do aktywowania.", true);
      return;
    }

    const currentId = state.activeItemId || selectedItemId;
    const currentIndex = rows.findIndex((row) => row.item.id === currentId);
    let nextIndex = currentIndex + direction;
    if (currentIndex < 0) {
      nextIndex = direction > 0 ? 0 : rows.length - 1;
    }
    nextIndex = Math.max(0, Math.min(rows.length - 1, nextIndex));
    if (nextIndex === currentIndex) {
      if (direction > 0 && state.activeItemId) {
        finishActiveItem();
        return;
      }
      showMessage(direction < 0 ? "To pierwszy punkt obrad." : "To ostatni punkt obrad.");
      return;
    }
    const isBacktracking = direction < 0 && Boolean(state.activeItemId);
    activateItem(rows[nextIndex].item.id, isBacktracking ? { deferCurrent: true, restoreTarget: true } : {});
  }

  function finishActiveItem() {
    const activeItem = state.items.find((candidate) => candidate.id === state.activeItemId);
    if (!activeItem) {
      showMessage("Brak aktywnego punktu do zakończenia.", true);
      return;
    }

    if (!activeItem.actualEndAt) {
      activeItem.actualEndAt =
        calculateEndIsoFromValues(activeItem.actualStartAt, activeItem.durationMinutes) || new Date().toISOString();
    }
    if (activeItem.flowStatus === "deferred") {
      activeItem.flowStatus = null;
    }
    state.activeItemId = null;
    selectedItemId = activeItem.id;
    savePlan();
    render();
    showMessage("Zakończono ostatni punkt.");
  }

  function addRootItem() {
    const siblings = state.items.filter((item) => item.parentId === null);
    const item = createItem({
      sortOrder: nextSortOrder(siblings),
    });
    state.items.push(item);
    selectedItemId = item.id;
    savePlan();
    render();
    focusTextInput(item.id);
  }

  function addChildItem(parentId) {
    const parent = state.items.find((item) => item.id === parentId);
    if (!parent) {
      showMessage("Najpierw zaznacz punkt nadrzędny.", true);
      return;
    }
    const siblings = state.items.filter((item) => item.parentId === parentId);
    const item = createItem({
      parentId,
      sortOrder: nextSortOrder(siblings),
    });
    state.items.push(item);
    selectedItemId = item.id;
    savePlan();
    render();
    focusTextInput(item.id);
  }

  function nextSortOrder(siblings) {
    if (!siblings.length) {
      return 1;
    }
    return Math.max(...siblings.map((item) => Number(item.sortOrder) || 0)) + 1;
  }

  function selectedItem() {
    return state.items.find((candidate) => candidate.id === selectedItemId) || null;
  }

  function sameParent(left, right) {
    return (left || null) === (right || null);
  }

  function siblingItems(parentId) {
    return state.items
      .filter((item) => sameParent(item.parentId, parentId))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.text.localeCompare(b.text, "pl"));
  }

  function normalizeSiblingOrder(parentId) {
    siblingItems(parentId).forEach((item, index) => {
      item.sortOrder = index + 1;
    });
  }

  function canMoveSelected(direction) {
    const item = selectedItem();
    if (!item) {
      return false;
    }
    const siblings = siblingItems(item.parentId);
    const index = siblings.findIndex((candidate) => candidate.id === item.id);
    return index >= 0 && index + direction >= 0 && index + direction < siblings.length;
  }

  function canPromoteSelected() {
    return Boolean(selectedItem()?.parentId);
  }

  function canDemoteSelected() {
    const item = selectedItem();
    if (!item) {
      return false;
    }
    const siblings = siblingItems(item.parentId);
    return siblings.findIndex((candidate) => candidate.id === item.id) > 0;
  }

  function moveSelected(direction) {
    const item = selectedItem();
    if (!item || !canMoveSelected(direction)) {
      showMessage("Nie można przesunąć zaznaczonego punktu w tym kierunku.", true);
      return;
    }

    normalizeSiblingOrder(item.parentId);
    const siblings = siblingItems(item.parentId);
    const index = siblings.findIndex((candidate) => candidate.id === item.id);
    const neighbor = siblings[index + direction];
    const currentOrder = item.sortOrder;
    item.sortOrder = neighbor.sortOrder;
    neighbor.sortOrder = currentOrder;
    savePlan();
    render();
  }

  function promoteSelected() {
    const item = selectedItem();
    if (!item || !item.parentId) {
      showMessage("Zaznaczony punkt jest już na najwyższym dostępnym poziomie.", true);
      return;
    }

    const parent = state.items.find((candidate) => candidate.id === item.parentId);
    if (!parent) {
      item.parentId = null;
      item.sortOrder = nextSortOrder(siblingItems(null));
      savePlan();
      render();
      return;
    }

    const oldParentId = item.parentId;
    const newParentId = parent.parentId || null;
    normalizeSiblingOrder(newParentId);
    item.parentId = newParentId;
    item.sortOrder = parent.sortOrder + 0.5;
    normalizeSiblingOrder(oldParentId);
    normalizeSiblingOrder(newParentId);
    savePlan();
    render();
  }

  function demoteSelected() {
    const item = selectedItem();
    if (!item || !canDemoteSelected()) {
      showMessage("Zaznaczony punkt nie ma poprzedniego punktu, pod który można go przenieść.", true);
      return;
    }

    const oldParentId = item.parentId || null;
    normalizeSiblingOrder(oldParentId);
    const siblings = siblingItems(oldParentId);
    const index = siblings.findIndex((candidate) => candidate.id === item.id);
    const newParent = siblings[index - 1];
    item.parentId = newParent.id;
    item.sortOrder = nextSortOrder(siblingItems(newParent.id));
    normalizeSiblingOrder(oldParentId);
    normalizeSiblingOrder(newParent.id);
    savePlan();
    render();
  }

  function updateItemField(itemId, field, value) {
    const item = state.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      return;
    }
    if (field === "text") {
      item.text = value.trim() || "Bez opisu";
    }
    if (field === "durationMinutes") {
      item.durationMinutes = Math.max(0, Math.round(Number(value) || 0));
    }
    savePlan();
    render();
  }

  function markWaiting(itemId) {
    const item = state.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      showMessage("Najpierw zaznacz punkt obrad.", true);
      return;
    }

    item.struck = false;
    item.actualStartAt = null;
    item.actualEndAt = null;
    item.flowStatus = null;
    if (state.activeItemId === item.id) {
      state.activeItemId = null;
    }
    selectedItemId = item.id;
    savePlan();
    render();
  }

  function toggleStrike(itemId) {
    const item = state.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      return;
    }
    item.struck = !item.struck;
    if (item.struck) {
      item.flowStatus = null;
    }
    if (item.struck && state.activeItemId === item.id) {
      item.actualEndAt = calculateEndIsoFromValues(item.actualStartAt, item.durationMinutes) || new Date().toISOString();
      state.activeItemId = null;
    }
    savePlan();
    render();
  }

  function deleteItem(itemId) {
    const item = state.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      return;
    }
    const descendants = descendantIds(itemId);
    const count = descendants.length + 1;
    const confirmed = window.confirm(
      count === 1
        ? `Usunąć punkt "${item.text}"?`
        : `Usunąć punkt "${item.text}" oraz ${descendants.length} podpunktów?`
    );
    if (!confirmed) {
      return;
    }

    const idsToRemove = new Set([itemId, ...descendants]);
    state.items = state.items.filter((candidate) => !idsToRemove.has(candidate.id));
    if (idsToRemove.has(state.activeItemId)) {
      state.activeItemId = null;
    }
    if (idsToRemove.has(selectedItemId)) {
      selectedItemId = firstItemId(state.items);
    }
    savePlan();
    render();
  }

  function clearAgenda() {
    if (!state.items.length) {
      showMessage("Agenda jest już pusta.");
      return;
    }

    const confirmed = window.confirm("Usunąć wszystkie punkty agendy? Tej operacji nie można cofnąć.");
    if (!confirmed) {
      return;
    }

    state.items = [];
    state.activeItemId = null;
    selectedItemId = null;
    savePlan();
    render();
    showMessage("Wyczyszczono agendę.");
  }

  function descendantIds(parentId) {
    const result = [];
    const stack = [parentId];
    while (stack.length) {
      const current = stack.pop();
      for (const item of state.items) {
        if (item.parentId === current) {
          result.push(item.id);
          stack.push(item.id);
        }
      }
    }
    return result;
  }

  function exportPlan() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "porzadek-obrad.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showMessage("Wyeksportowano plan do JSON.");
  }

  function importPlan(file) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const validation = validatePlan(parsed);
        if (!validation.valid) {
          throw new Error(validation.message);
        }
        state = normalizePlan(parsed);
        selectedItemId = state.activeItemId || firstItemId(state.items);
        savePlan();
        render();
        showMessage("Zaimportowano plan z JSON.");
      } catch (error) {
        showMessage(`Import nie powiódł się: ${error.message}`, true);
      } finally {
        elements.importInput.value = "";
      }
    };
    reader.onerror = () => {
      showMessage("Nie można odczytać pliku JSON.", true);
      elements.importInput.value = "";
    };
    reader.readAsText(file);
  }

  function timerSecondsFromInputs() {
    const minutes = Math.max(0, Number(elements.timerMinutes.value) || 0);
    const seconds = Math.min(59, Math.max(0, Number(elements.timerSeconds.value) || 0));
    elements.timerSeconds.value = String(seconds);
    return Math.round(minutes * 60 + seconds);
  }

  function toggleTimer() {
    if (timer.alarmActive) {
      showMessage("Zresetuj stoper przed kolejnym odliczaniem.", true);
      return;
    }
    if (timer.running) {
      pauseTimer();
      return;
    }

    if (timer.remainingSeconds <= 0) {
      timer.remainingSeconds = timerSecondsFromInputs();
    }
    if (timer.remainingSeconds <= 0) {
      showMessage("Ustaw czas minutnika większy niż zero.", true);
      return;
    }

    timer.running = true;
    prepareTimerAudio();
    timer.deadline = Date.now() + timer.remainingSeconds * 1000;
    timer.intervalId = window.setInterval(tickTimer, 250);
    renderTimer();
  }

  function pauseTimer() {
    if (!timer.running) {
      return;
    }
    timer.remainingSeconds = Math.max(0, Math.ceil((timer.deadline - Date.now()) / 1000));
    timer.running = false;
    stopTimerInterval();
    renderTimer();
  }

  function resetTimer() {
    timer.running = false;
    timer.alarmActive = false;
    stopTimerInterval();
    timer.remainingSeconds = timerSecondsFromInputs();
    renderTimer();
  }

  function tickTimer() {
    timer.remainingSeconds = Math.max(0, Math.ceil((timer.deadline - Date.now()) / 1000));
    if (timer.remainingSeconds <= 0) {
      timer.running = false;
      stopTimerInterval();
      triggerTimerAlarm();
    }
    renderTimer();
  }

  function stopTimerInterval() {
    if (timer.intervalId) {
      window.clearInterval(timer.intervalId);
      timer.intervalId = null;
    }
  }

  function renderTimer() {
    elements.timerDisplay.textContent = formatDuration(timer.remainingSeconds);
    elements.timerToggleButton.textContent = timer.running ? "Pauza" : "Start";
    elements.timerBox.classList.toggle("timer-alarm", timer.alarmActive);
  }

  function prepareTimerAudio() {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      return;
    }
    if (!audioContext) {
      audioContext = new AudioContextConstructor();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
  }

  function triggerTimerAlarm() {
    timer.alarmActive = true;
    playTimerSound();
  }

  function playTimerSound() {
    try {
      prepareTimerAudio();
      if (!audioContext) {
        return;
      }
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.5);
    } catch (error) {
      console.warn("Nie można odtworzyć dźwięku stopera:", error);
    }
  }

  function updateStickyTitle() {
    elements.stickyTitle.classList.toggle("visible", window.scrollY > 96);
  }

  function showMessage(text, isError = false) {
    elements.messageBar.textContent = text;
    elements.messageBar.classList.toggle("error", isError);
    if (messageTimeout) {
      window.clearTimeout(messageTimeout);
    }
    messageTimeout = window.setTimeout(() => {
      elements.messageBar.textContent = "";
      elements.messageBar.classList.remove("error");
    }, 5000);
  }

  function formatClock(date) {
    return date.toLocaleTimeString("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function formatTime(date) {
    if (!date) {
      return "—";
    }
    return date.toLocaleTimeString("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatTimeValue(value) {
    if (!value) {
      return "—";
    }
    return formatTime(new Date(value));
  }

  function formatDelta(ms) {
    const totalSeconds = Math.round(ms / 1000);
    if (totalSeconds === 0) {
      return "0:00";
    }
    const sign = totalSeconds > 0 ? "+" : "−";
    const abs = Math.abs(totalSeconds);
    const minutes = Math.floor(abs / 60);
    const seconds = abs % 60;
    return `${sign}${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function focusTextInput(itemId) {
    window.requestAnimationFrame(() => {
      const input = elements.agendaBody.querySelector(`input[data-field="text"][data-id="${CSS.escape(itemId)}"]`);
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  elements.titleInput.addEventListener("change", () => {
    state.title = elements.titleInput.value.trim() || "Plan spotkania";
    savePlan();
    render();
  });

  elements.plannedStartInput.addEventListener("change", () => {
    if (!isTimeValue(elements.plannedStartInput.value)) {
      showMessage("Podaj poprawną godzinę rozpoczęcia.", true);
      render();
      return;
    }
    state.plannedStartTime = elements.plannedStartInput.value;
    savePlan();
    render();
  });

  elements.agendaBody.addEventListener("click", (event) => {
    if (event.target.closest("input")) {
      return;
    }

    const row = event.target.closest("tr[data-id]");
    if (row) {
      selectedItemId = row.dataset.id;
      render();
    }
  });

  elements.agendaBody.addEventListener("change", (event) => {
    const input = event.target.closest("input[data-field]");
    if (!input) {
      return;
    }
    updateItemField(input.dataset.id, input.dataset.field, input.value);
  });

  elements.agendaBody.addEventListener("focusin", (event) => {
    const input = event.target.closest("input[data-id]");
    if (!input) {
      return;
    }
    selectedItemId = input.dataset.id;
    updateStatus();
  });

  elements.addRootButton.addEventListener("click", addRootItem);
  elements.addChildButton.addEventListener("click", () => addChildItem(selectedItemId));
  elements.markWaitingButton.addEventListener("click", () => markWaiting(selectedItemId));
  elements.toggleStrikeButton.addEventListener("click", () => toggleStrike(selectedItemId));
  elements.deleteButton.addEventListener("click", () => deleteItem(selectedItemId));
  elements.clearAgendaButton.addEventListener("click", clearAgenda);
  elements.moveUpButton.addEventListener("click", () => moveSelected(-1));
  elements.moveDownButton.addEventListener("click", () => moveSelected(1));
  elements.promoteButton.addEventListener("click", promoteSelected);
  elements.demoteButton.addEventListener("click", demoteSelected);
  elements.previousButton.addEventListener("click", () => activateRelative(-1));
  elements.activateButton.addEventListener("click", activateSelected);
  elements.nextButton.addEventListener("click", () => activateRelative(1));

  elements.timerToggleButton.addEventListener("click", toggleTimer);
  elements.timerResetButton.addEventListener("click", resetTimer);
  elements.timerMinutes.addEventListener("change", resetTimer);
  elements.timerSeconds.addEventListener("change", resetTimer);

  elements.editModeButton.addEventListener("click", () => {
    editMode = !editMode;
    render();
  });

  window.addEventListener("scroll", updateStickyTitle, { passive: true });

  elements.exportButton.addEventListener("click", exportPlan);
  elements.importButton.addEventListener("click", () => elements.importInput.click());
  elements.importInput.addEventListener("change", () => importPlan(elements.importInput.files[0]));
  elements.printButton.addEventListener("click", () => window.print());

  window.setInterval(() => {
    updateStatus();
    if (!editMode) {
      const activeDelayCell = elements.agendaBody.querySelector("tr.active .delay-cell");
      const activeRow = lastAgendaRows.find((row) => row.item.id === state.activeItemId);
      if (activeDelayCell && activeRow) {
        const delay = computeDelay(activeRow, new Date());
        activeDelayCell.textContent = delay.label;
        activeDelayCell.className = `delay-cell ${delay.className}`.trim();
      }
    }
  }, 1000);

  savePlan();
  renderTimer();
  render();
  updateStickyTitle();
})();
