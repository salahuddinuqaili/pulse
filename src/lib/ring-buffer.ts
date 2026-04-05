/** Fixed-size circular buffer. 300 entries = 5 minutes at 1s polling. */
export const BUFFER_SIZE = 300;

export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private count = 0;

  constructor(private capacity: number = BUFFER_SIZE) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /** Get the most recent item. */
  latest(): T | undefined {
    if (this.count === 0) return undefined;
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[idx];
  }

  /** Get the last N items, oldest first. */
  getLastN(n: number): T[] {
    const take = Math.min(n, this.count);
    const result: T[] = [];
    const start = (this.head - take + this.capacity) % this.capacity;
    for (let i = 0; i < take; i++) {
      const idx = (start + i) % this.capacity;
      result.push(this.buffer[idx] as T);
    }
    return result;
  }

  /** Get all items in order (oldest first). */
  toArray(): T[] {
    return this.getLastN(this.count);
  }

  get size(): number {
    return this.count;
  }

  get isFull(): boolean {
    return this.count === this.capacity;
  }
}
