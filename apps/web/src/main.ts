interface AppEvent {
  id: string
  title: string
  time: string
}

interface AppTask {
  id: string
  title: string
  done: boolean
}

const state = {
  events: [] as AppEvent[],
  tasks: [] as AppTask[],
  selectedTime: '',
  selectedEvent: null as AppEvent | null
}

function uid() {
  return Math.random().toString(36).slice(2)
}

// ─── Auth page ────────────────────────────────────────────────────────────────

function renderAuth() {
  const app = document.getElementById('app')!
  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <h1>Time Calendar Manager</h1>
        <label for="email">Email</label>
        <input id="email" type="email" name="email" placeholder="you@example.com" />
        <label for="password">Password</label>
        <input id="password" type="password" name="password" placeholder="••••••••" />
        <div class="btn-group">
          <button class="btn btn-primary" id="signup-btn">Sign up</button>
          <button class="btn btn-secondary" id="signin-btn">Sign in</button>
        </div>
      </div>
    </div>
  `
  document.getElementById('signup-btn')!.addEventListener('click', () => {
    navigate('#calendar')
  })
  document.getElementById('signin-btn')!.addEventListener('click', () => {
    navigate('#calendar')
  })
}

// ─── Calendar page ────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 08:00–20:00

function formatHour(h: number) {
  return `${h.toString().padStart(2, '0')}:00`
}

function renderCalendar() {
  const app = document.getElementById('app')!
  const rows = HOURS.map(h => {
    const time = formatHour(h)
    const label = h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
    const eventsAtSlot = state.events.filter(e => e.time === time)
    const chips = eventsAtSlot.map(ev =>
      `<span class="event-chip" data-event-id="${ev.id}">${ev.title}</span>`
    ).join('')
    return `
      <div class="time-label">${label}</div>
      <div class="time-slot" data-time="${time}">${chips}</div>
    `
  }).join('')

  app.innerHTML = `
    <nav>
      <span>Time Calendar Manager</span>
      <a href="#tasks" style="color:white;text-decoration:none;margin-right:8px">Tasks</a>
      <button id="signout-btn">Sign out</button>
    </nav>
    <div class="calendar-page">
      <div class="calendar-grid">${rows}</div>
    </div>

    <!-- Quick-create / event-detail popover -->
    <div id="popover" class="popover">
      <button class="close-btn" id="close-popover">×</button>
      <div id="popover-create">
        <h3 id="popover-time-label"></h3>
        <input id="event-title-input" placeholder="Event title" />
        <div class="btn-row">
          <button class="btn btn-primary" id="save-event-btn">Save</button>
        </div>
      </div>
      <div id="popover-detail" style="display:none">
        <h3 id="detail-title"></h3>
        <p id="detail-time"></p>
        <div class="btn-row">
          <button class="btn btn-primary" id="edit-event-btn">Edit</button>
        </div>
      </div>
    </div>

    <!-- Edit modal -->
    <div id="modal-overlay" class="modal-overlay">
      <div class="modal">
        <h2>Edit Event</h2>
        <label for="modal-title">Title</label>
        <input id="modal-title" />
        <label for="modal-time">Time</label>
        <input id="modal-time" />
        <div class="btn-row">
          <button class="btn btn-secondary" id="close-modal-btn">Cancel</button>
          <button class="btn btn-primary" id="save-modal-btn">Save</button>
        </div>
      </div>
    </div>
  `

  bindCalendarEvents()
}

function openCreatePopover(time: string, anchorEl: HTMLElement) {
  state.selectedTime = time
  state.selectedEvent = null
  const popover = document.getElementById('popover')!
  const create = document.getElementById('popover-create')!
  const detail = document.getElementById('popover-detail')!
  const label = document.getElementById('popover-time-label')!
  const input = document.getElementById('event-title-input') as HTMLInputElement
  label.textContent = time
  input.value = ''
  create.style.display = ''
  detail.style.display = 'none'
  positionPopover(popover, anchorEl)
  popover.classList.add('visible')
  input.focus()
}

function openDetailPopover(ev: AppEvent, anchorEl: HTMLElement) {
  state.selectedEvent = ev
  const popover = document.getElementById('popover')!
  const create = document.getElementById('popover-create')!
  const detail = document.getElementById('popover-detail')!
  document.getElementById('detail-title')!.textContent = ev.title
  document.getElementById('detail-time')!.textContent = ev.time
  create.style.display = 'none'
  detail.style.display = ''
  positionPopover(popover, anchorEl)
  popover.classList.add('visible')
}

function positionPopover(popover: HTMLElement, anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect()
  popover.style.top = `${rect.bottom + 8}px`
  popover.style.left = `${rect.left}px`
}

function closePopover() {
  document.getElementById('popover')?.classList.remove('visible')
}

function saveEvent() {
  const input = document.getElementById('event-title-input') as HTMLInputElement
  const title = input.value.trim()
  if (!title) return
  state.events.push({ id: uid(), title, time: state.selectedTime })
  closePopover()
  renderCalendar()
}

function openModal(ev: AppEvent) {
  const overlay = document.getElementById('modal-overlay')!
  ;(document.getElementById('modal-title') as HTMLInputElement).value = ev.title
  ;(document.getElementById('modal-time') as HTMLInputElement).value = ev.time
  overlay.classList.add('visible')
}

function closeModal() {
  document.getElementById('modal-overlay')?.classList.remove('visible')
}

function bindCalendarEvents() {
  document.getElementById('signout-btn')?.addEventListener('click', () => navigate('#auth'))
  document.getElementById('close-popover')?.addEventListener('click', closePopover)
  document.getElementById('close-modal-btn')?.addEventListener('click', closeModal)
  document.getElementById('save-modal-btn')?.addEventListener('click', closeModal)

  document.getElementById('save-event-btn')?.addEventListener('click', saveEvent)

  document.getElementById('event-title-input')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') saveEvent()
  })

  document.getElementById('edit-event-btn')?.addEventListener('click', () => {
    if (state.selectedEvent) {
      closePopover()
      openModal(state.selectedEvent)
    }
  })

  document.querySelectorAll('.time-slot').forEach(slot => {
    slot.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest('.event-chip')
      if (chip) {
        const eventId = chip.getAttribute('data-event-id')!
        const ev = state.events.find(ev => ev.id === eventId)
        if (ev) openDetailPopover(ev, chip as HTMLElement)
      } else {
        const time = (slot as HTMLElement).dataset['time']!
        openCreatePopover(time, slot as HTMLElement)
      }
    })
  })
}

// ─── Tasks page ───────────────────────────────────────────────────────────────

function renderTasks() {
  const app = document.getElementById('app')!
  const taskItems = state.tasks.map(t => `
    <li class="task-item${t.done ? ' done' : ''}" data-task-id="${t.id}">
      <input type="checkbox" ${t.done ? 'checked' : ''} data-task-check="${t.id}" />
      <span>${t.title}</span>
    </li>
  `).join('')

  app.innerHTML = `
    <nav>
      <span>Time Calendar Manager</span>
      <a href="#calendar" style="color:white;text-decoration:none;margin-right:8px">Calendar</a>
      <button id="signout-btn">Sign out</button>
    </nav>
    <div class="tasks-page">
      <div class="tasks-header">
        <h2>Tasks</h2>
        <button class="btn btn-primary" id="new-task-btn">+ New Task</button>
      </div>
      <div id="task-input-row" class="task-input-row" style="display:none">
        <input id="new-task-input" placeholder="Task title" />
        <button class="btn btn-primary" id="add-task-btn">Add</button>
      </div>
      <ul class="task-list" id="task-list">${taskItems}</ul>
    </div>
  `

  bindTaskEvents()
}

function addTask() {
  const input = document.getElementById('new-task-input') as HTMLInputElement
  const title = input.value.trim()
  if (!title) return
  state.tasks.push({ id: uid(), title, done: false })
  input.value = ''
  document.getElementById('task-input-row')!.style.display = 'none'
  renderTasks()
}

function bindTaskEvents() {
  document.getElementById('signout-btn')?.addEventListener('click', () => navigate('#auth'))

  document.getElementById('new-task-btn')?.addEventListener('click', () => {
    const row = document.getElementById('task-input-row')!
    row.style.display = 'flex'
    ;(document.getElementById('new-task-input') as HTMLInputElement).focus()
  })

  document.getElementById('add-task-btn')?.addEventListener('click', addTask)

  document.getElementById('new-task-input')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') addTask()
  })

  document.querySelectorAll('[data-task-check]').forEach(cb => {
    cb.addEventListener('change', () => {
      const taskId = (cb as HTMLElement).dataset['taskCheck']!
      const task = state.tasks.find(t => t.id === taskId)
      if (task) {
        task.done = true
        renderTasks()
      }
    })
  })
}

// ─── Router ───────────────────────────────────────────────────────────────────

function navigate(hash: string) {
  window.location.hash = hash
  render()
}

function render() {
  const hash = window.location.hash.replace('#', '') || 'auth'
  if (hash === 'calendar') renderCalendar()
  else if (hash === 'tasks') renderTasks()
  else renderAuth()
}

window.addEventListener('hashchange', render)
render()
