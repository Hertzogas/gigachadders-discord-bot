import Database from 'better-sqlite3';

export type User = {
discordId: string;
steamId?: string | null;
isVip: number; // 0/1
rating: number; // success rate score
penaltyUntil?: number | null; // epoch ms
};

export type QueueEntry = {
discordId: string;
joinedAt: number;
};

export class Store {
	private db: Database.Database;

constructor(filename: string = 'data.db') {
this.db = new Database(filename);
this.migrate();
}

	private migrate() {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS users (
				discord_id TEXT PRIMARY KEY,
				steam_id TEXT,
				is_vip INTEGER NOT NULL DEFAULT 0,
				rating INTEGER NOT NULL DEFAULT 1000,
				penalty_until INTEGER
			);
			CREATE TABLE IF NOT EXISTS queue (
				discord_id TEXT PRIMARY KEY,
				joined_at INTEGER NOT NULL
			);
			CREATE TABLE IF NOT EXISTS matches (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				created_at INTEGER NOT NULL,
				status TEXT NOT NULL,
				channel_id TEXT,
				server_ip TEXT,
				server_password TEXT
			);
			CREATE TABLE IF NOT EXISTS match_players (
				match_id INTEGER NOT NULL,
				discord_id TEXT NOT NULL,
				PRIMARY KEY(match_id, discord_id)
			);
		`);
	}

upsertUser(user: Partial<User> & { discordId: string }) {
const existing = this.getUser(user.discordId);
if (existing) {
const merged: User = {
discordId: existing.discordId,
steamId: user.steamId ?? existing.steamId ?? null,
isVip: user.isVip ?? existing.isVip,
rating: user.rating ?? existing.rating,
penaltyUntil: user.penaltyUntil ?? existing.penaltyUntil ?? null,
};
			this.db
				.prepare(`REPLACE INTO users (discord_id, steam_id, is_vip, rating, penalty_until) VALUES (@discordId, @steamId, @isVip, @rating, @penaltyUntil)`)
				.run(merged);
return merged;
} else {
const created: User = {
discordId: user.discordId,
steamId: user.steamId ?? null,
isVip: user.isVip ?? 0,
rating: user.rating ?? 1000,
penaltyUntil: user.penaltyUntil ?? null,
};
			this.db
				.prepare(`INSERT INTO users (discord_id, steam_id, is_vip, rating, penalty_until) VALUES (@discordId, @steamId, @isVip, @rating, @penaltyUntil)`)
				.run(created);
return created;
}
}

getUser(discordId: string): User | undefined {
		const row = this.db
			.prepare(`SELECT discord_id as discordId, steam_id as steamId, is_vip as isVip, rating, penalty_until as penaltyUntil FROM users WHERE discord_id=?`)
			.get(discordId);
return row as User | undefined;
}

setVip(discordId: string, isVip: boolean) {
this.upsertUser({ discordId, isVip: isVip ? 1 : 0 });
}

addToQueue(discordId: string) {
const now = Date.now();
		this.db
			.prepare(`REPLACE INTO queue (discord_id, joined_at) VALUES (?, ?)`)
			.run(discordId, now);
}

removeFromQueue(discordId: string) {
		this.db.prepare(`DELETE FROM queue WHERE discord_id=?`).run(discordId);
}

getQueue(): QueueEntry[] {
		return this.db
			.prepare(`SELECT discord_id as discordId, joined_at as joinedAt FROM queue`)
			.all() as QueueEntry[];
}

clearQueue(discordIds: string[]) {
		const stmt = this.db.prepare(`DELETE FROM queue WHERE discord_id=?`);
const tx = this.db.transaction((ids: string[]) => ids.forEach(id => stmt.run(id)));
tx(discordIds);
}
}