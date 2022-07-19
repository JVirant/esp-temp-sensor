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

	app.use(async (ctxt, next) => {
		if (ctxt.path !== "/" || ctxt.method !== "GET")
			return next();
		ctxt.type = "text/html";
		ctxt.body = indexHtml;
	});

	app.listen(parseInt(process.env.HTTP_PORT ?? "8080"));
}

main().catch(err => console.error(err));

const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head><title>Temp</title></head>
<body>
<canvas id="temperature"></canvas>

<script src="https://cdn.jsdelivr.net/npm/luxon@3.0.1/build/global/luxon.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@3.8.0/dist/chart.min.js"></script>
<script>${String(htmlMainJS)};htmlMainJS();</script>
</body>
</html>`;

interface Record {
	name: string;
	temperature: number;
	humidity: number;
	created_at: string;
}

declare const luxon: any;
declare const Chart: any;
async function htmlMainJS() {
	const exteriorRecords: Record[] = [];
	const refresh = async () => {
		const rows: Record[] = await fetch(`records`).then(r => r.json());
		rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
		exteriorRecords.length = 0;
		exteriorRecords.push(...rows.filter(r => r.name === "exterior"));
	};

	await refresh();

	const ctx = document.getElementsByTagName("canvas").item(0)?.getContext("2d");
	if (!ctx)
		throw new Error("canvas not found");
	new Chart(ctx, {
		type: "line",
		data: {
			labels: exteriorRecords.map(r => luxon.DateTime.fromFormat(r.created_at, "yyyy-LL-dd HH:mm:ss", { zone: "utc" }).setZone("Europe/Paris").toLocaleString(luxon.DateTime.DATETIME_SHORT)),
			datasets: [{
				label: "Exterior",
				data: exteriorRecords.map(r => r.temperature),
				fillColor: "rgba(255, 99, 132, 0.2)",
				strokeColor: "rgba(0, 0, 0, 1)",
			}],
		}
	});

}
