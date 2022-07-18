import Koa from "koa";
import bodyParser from "koa-bodyparser";
import { open } from "sqlite";
import { Database } from "sqlite3";

async function main() {
	const db = await open({
		driver: Database,
		filename: process.env.DB_PATH || "db.sqlite",
	});
	await db.run(
		`CREATE TABLE IF NOT EXISTS records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			created_at TEXT NOT NULL,
			name TEXT NOT NULL,
			temperature REAL NOT NULL,
			humidity REAL NOT NULL
		)`
	);
	await db.close();

	const app = new Koa();

	app.use(bodyParser());
	app.use(async (ctxt, next) => {
		console.time(`${ctxt.method} ${ctxt.path}`);
		await next();
		console.timeEnd(`${ctxt.method} ${ctxt.path}`);
	})
	app.use(async (ctxt, next) => {
		if (ctxt.path !== `/sensor` || ctxt.method !== "POST" || !ctxt.request.body)
			return next();
		console.log(ctxt.request.body);

		const db = await open({
			driver: Database,
			filename: process.env.DB_PATH || "db.sqlite",
		});
		await db.run(
			`insert into records (created_at, name, temperature, humidity) values (datetime(), ?, ?, ?)`,
			ctxt.request.body.name,
			ctxt.request.body.temperature,
			ctxt.request.body.humidity,
		);
		await db.close();

		ctxt.body = { ok: true };
	});

	app.use(async (ctxt, next) => {
		if (ctxt.path !== `/records` || ctxt.method !== "GET")
			return next();

		const db = await open({
			driver: Database,
			filename: process.env.DB_PATH || "db.sqlite",
		});
		const rows = await db.all(`
			select
					created_at, name, temperature, humidity
				from records
				where created_at >= datetime('now', '-7 days')
				order by created_at desc
		`);
		await db.close();

		ctxt.body = rows;
	});

	app.listen(parseInt(process.env.HTTP_PORT ?? "8080"));
}

main().catch(err => console.error(err));
