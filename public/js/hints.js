export class SmartHints {
  constructor(level) {
    this.level = level;
    this.steps = new Map();
    this.idle = 0;
    this.previous = '';
    this.box = document.querySelector('#hint-box');
    this.button = document.querySelector('[data-action="hint"]');
  }
  context() {
    const level = this.level;
    if (typeof level.getHintContext === 'function') {
      return level.getHintContext();
    } 
    if (level.stage === 'arrive') return ['reception', ['Find the warm desk lamp in the lobby. Someone is waiting there.', 'Walk north from the entrance toward reception, then use Interact near the desk.']];
    if (level.stage === 'key') return ['room', ['Read the number on your brass key. Door plates mark each room.', 'Room 009 is at the east end of the corridor, above the lounge. Interact with its door.']];
    if (level.stage === 'room' && !level.has('Photograph')) return ['photo', ['The room contains something more personal than a guest register.', 'Look beside the bedside lamp on the east side of Room 009.']];
    if (level.stage === 'room') return ['phone', ['The ringing telephone is part of your next objective.', 'Answer the telephone in Room 009. Listening does not force you to open the door afterward.']];
    if (!level.readReg) return ['register', ['The front door code is connected to the guests who never left.', 'Return to reception and read the register. Pay attention to the crossed-out entries, not the arrival times.']];
    if (!level.foundHidden) return ['light', ['Some messages are only visible when your flashlight is on.', 'Search the dust in Room 006 with your light on. The crossed entries in the register are important.']];
    return ['exit', ['The crossed-out room numbers are the clue. Their order matters.', 'Take the last digit of each crossed-out room in the order shown in the register. Return to the chained front doors in the south lobby.']];
  }
  update(delta) {
    const signature = `${this.level.stage}:${this.level.inventory.length}:${this.level.objectives.filter(objective => objective.done).length}`;
    if (signature !== this.previous) { this.previous = signature; this.idle = 0; this.button.classList.remove('hint-ready'); }
    if (!this.level.frozen && !this.level.ended) this.idle += delta;
    if (this.idle > 75) { this.button.classList.add('hint-ready'); this.button.title = 'A useful clue is ready (H)'; }
  }
  show() {
    if (this.level.ended || this.level.frozen) return;
    const [key, clues] = this.context();
    const step = this.steps.get(key) || 0;
    this.steps.set(key, Math.min(step + 1, clues.length - 1));
    this.box.replaceChildren();
    const heading = document.createElement('strong'); heading.textContent = 'A whisper from the book';
    const text = document.createElement('p'); text.textContent = clues[Math.min(step, clues.length - 1)];
    const dismiss = document.createElement('button'); dismiss.className = 'btn tiny'; dismiss.textContent = 'Dismiss'; dismiss.onclick = () => this.hide();
    this.box.append(heading, text, dismiss); this.box.hidden = false;
    this.idle = 0; this.button.classList.remove('hint-ready');
    clearTimeout(this.timer); this.timer = setTimeout(() => this.hide(), 14000);
  }
  hide() { clearTimeout(this.timer); this.box.hidden = true; }
}
