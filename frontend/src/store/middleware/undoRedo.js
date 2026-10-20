// Undo / Redo history stack middleware
export class HistoryManager {
  constructor(maxHistory = 50) {
    this.past = [];
    this.future = [];
    this.maxHistory = maxHistory;
  }

  push(state) {
    this.past.push(JSON.stringify(state));
    if (this.past.length > this.maxHistory) {
      this.past.shift();
    }
    this.future = [];
  }

  undo(currentState) {
    if (this.past.length === 0) return null;
    const previous = this.past.pop();
    this.future.push(JSON.stringify(currentState));
    return JSON.parse(previous);
  }

  redo(currentState) {
    if (this.future.length === 0) return null;
    const next = this.future.pop();
    this.past.push(JSON.stringify(currentState));
    return JSON.parse(next);
  }
}
