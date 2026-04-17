import { createWorldUI } from './ui';

function main(): void {
    try {
        const paleWorkSpaceContainer = document.querySelector('#workspace') as HTMLElement;
        if (!paleWorkSpaceContainer) {
            throw new Error('Scene container element not found...');
        }
        const canvas = document.createElement('canvas');
        paleWorkSpaceContainer.appendChild(canvas);
        createWorldUI(paleWorkSpaceContainer, canvas);
        console.log('PaleEngine Editor initialized successfully');
    } catch (error) {
        console.error('Failed to initialize PaleEngine Editor:', error);
    }
}
main();