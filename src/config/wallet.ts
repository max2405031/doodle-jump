const STORAGE_KEY = "yokaijump.wallet.v1";

export function loadCoins(): number {
	try {
		return Math.max(0, Number(localStorage.getItem(STORAGE_KEY)) || 0);
	} catch {
		return 0;
	}
}

export function saveCoins(amount: number): void {
	localStorage.setItem(STORAGE_KEY, String(amount));
}

export function addCoins(amount: number): number {
	const current = loadCoins();
	const next = current + amount;
	saveCoins(next);
	return next;
}

export function spendCoins(amount: number): boolean {
	const current = loadCoins();
	if (current < amount) return false;
	saveCoins(current - amount);
	return true;
}

export function getCoins(): number {
	return loadCoins();
}
