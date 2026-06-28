import { requireNativeModule, EventSubscription } from 'expo-modules-core';

const MediaSessionModule = requireNativeModule('MediaSession');

export interface MediaEvent {
    package: string;
    title: string;
    artist: string;
    album: string;
    state: 'playing' | 'paused' | 'stopped' | 'buffering' | 'unknown';
    position: number;
    duration: number;
    timestamp: number;
    artworkUri?: string;
}

export function requestPermission(): void {
    return MediaSessionModule.requestPermission();
}

export function hasPermission(): boolean {
    return MediaSessionModule.hasPermission();
}

export function addMediaListener(listener: (event: MediaEvent) => void): EventSubscription {
    return MediaSessionModule.addListener('onMediaChanged', listener);
}

export function getState(): MediaEvent | null {
    return MediaSessionModule.getState();
}

export function play(): void {
    return MediaSessionModule.play();
}

export function pause(): void {
    return MediaSessionModule.pause();
}

export function skipNext(): void {
    return MediaSessionModule.skipNext();
}

export function skipPrevious(): void {
    return MediaSessionModule.skipPrevious();
}

export function seekTo(position: number): void {
    return MediaSessionModule.seekTo(position);
}

export { MediaSessionModule };
