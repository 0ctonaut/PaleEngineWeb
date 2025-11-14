import { BaseWindow } from './base-window';

export abstract class Panel extends BaseWindow {
    protected constructor(title: string) {
        super(title);
    }

    protected override onAttach(_container: HTMLElement): void {
        this.getElement().classList.add('pale-window-panel');
    }
}

