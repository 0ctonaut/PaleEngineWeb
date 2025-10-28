import { Bar } from './bar';

export class BottomBar extends Bar {
    constructor(mode: 'follow' | 'fixed' = 'fixed') {
        super({ position: 'bottom', mode });
    }
}
