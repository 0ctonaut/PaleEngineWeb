export type EventMap = Record<string, unknown>;

export type EventKey<T extends EventMap> = string & keyof T;

export type EventCallback<T> = (event: T) => void;

export class EventEmitter<T extends EventMap = EventMap> {
	private listeners: { [K in keyof T]?: Set<EventCallback<T[K]>> } = {};

	public on<K extends EventKey<T>>(type: K, listener: EventCallback<T[K]>): () => void {
		if (!this.listeners[type]) {
			this.listeners[type] = new Set();
		}
		this.listeners[type]!.add(listener);
		return () => this.off(type, listener);
	}

	public off<K extends EventKey<T>>(type: K, listener: EventCallback<T[K]>): void {
		this.listeners[type]?.delete(listener);
	}

	public emit<K extends EventKey<T>>(type: K, event: T[K]): void {
		this.listeners[type]?.forEach((listener) => listener(event));
	}

	public once<K extends EventKey<T>>(type: K, listener: EventCallback<T[K]>): void {
		const onceListener: EventCallback<T[K]> = (event) => {
			listener(event);
			this.off(type, onceListener);
		};
		this.on(type, onceListener);
	}

	public clear(): void {
		this.listeners = {};
	}
}