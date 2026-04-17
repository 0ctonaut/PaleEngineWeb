export type EventCallback<T> = (event: T) => void;

export class EventEmitter<Events extends { [K in keyof Events]: unknown } = Record<string, unknown>> {
	private listeners: { [K in keyof Events]?: Set<EventCallback<Events[K]>> } = {} as any;

	public on<K extends keyof Events>(type: K, listener: EventCallback<Events[K]>): () => void {
		if (!this.listeners[type]) {
			this.listeners[type] = new Set();
		}
		this.listeners[type]!.add(listener);
		return () => this.off(type, listener);
	}

	public off<K extends keyof Events>(type: K, listener: EventCallback<Events[K]>): void {
		this.listeners[type]?.delete(listener);
	}

	public emit<K extends keyof Events>(type: K, event: Events[K]): void {
		this.listeners[type]?.forEach((listener) => listener(event));
	}

	public once<K extends keyof Events>(type: K, listener: EventCallback<Events[K]>): void {
		const onceListener: EventCallback<Events[K]> = (event) => {
			listener(event);
			this.off(type, onceListener);
		};
		this.on(type, onceListener);
	}

	public clear(): void {
		this.listeners = {} as any;
	}
}