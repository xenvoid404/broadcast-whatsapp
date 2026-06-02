export const now = () => new Date().toISOString();
export const today = () => new Date().toISOString().split('T')[0];
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function randomTime(startHour: number, endHour: number): string {
    const totalMins = (endHour - startHour) * 60;
    const rand = Math.floor(Math.random() * totalMins);
    const h = startHour + Math.floor(rand / 60);
    const m = rand % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isTimeReached(hhmm: string): boolean {
    const [h, m] = hhmm.split(':').map(Number);
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes() >= h * 60 + m;
}

export function extractGroupLinks(text: string): string[] {
    const matches = text.match(/https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{20,24}/g) ?? [];
    return [...new Set(matches)];
}
