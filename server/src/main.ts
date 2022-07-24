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

	// test generate false values
	app.use(async (ctxt, next) => {
		if (ctxt.path !== "/generate" || ctxt.method !== "GET")
			return next();
		const db = await open({
			driver: Database,
			filename: process.env.DB_PATH || "db.sqlite",
		});
		await db.run(`delete from records`);
		let temp = 150 + Math.random() * 200;
		let humidity = 300 + Math.random() * 200;
		for (let i = 0; i < 100; ++i) {
			temp += Math.random() * 20 - 10;
			humidity += Math.random() * 20 - 10;
			await db.run(
				`insert into records (created_at, name, temperature, humidity) values (datetime('now', '-${i*10} minutes'), ?, ?, ?)`,
				"exterior",
				Math.round(temp) / 10,
				Math.round(humidity) / 10,
			);
		}
		temp = 150 + Math.random() * 200;
		humidity = 300 + Math.random() * 200;
		for (let i = 0; i < 100; ++i) {
			temp += Math.random() * 20 - 10;
			humidity += Math.random() * 20 - 10;
			await db.run(
				`insert into records (created_at, name, temperature, humidity) values (datetime('now', '-${i*10} minutes'), ?, ?, ?)`,
				"cave",
				Math.round(temp) / 10,
				Math.round(humidity) / 10,
			);
		}
		await db.close();
		ctxt.body = "ok";
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
<script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
<script>${String(htmlMainJS)};htmlMainJS();</script>
</body>
</html>`;

interface Row {
	name: string;
	temperature: number;
	humidity: number;
	created_at: string;
}

declare const luxon: any;
declare const Chart: any;
async function htmlMainJS() {
	const colors: Record<string, string | undefined> = {
		"exterior": "rgba(170, 0, 0, 255)",
		"cave": "rgba(0, 170, 0, 255)",
	};

	const records: { [name: string]: Row[] } = {};
	const datasets: unknown[] = [];
	const refresh = async () => {
		const rows: Row[] = await fetch(`records`).then(r => r.json());
		rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
		const sensors = new Set(rows.map(r => r.name));
		Object.assign(records, Object.fromEntries([...sensors.values()].map(name => [name, rows.filter(r => r.name === name)])));
		datasets.length = 0;
		datasets.push(...Object.entries(records).map(([label, records]) => ({
			label,
			data: records.filter(r => r.name === label).map(r => ({ x: luxon.DateTime.fromFormat(r.created_at, "yyyy-LL-dd HH:mm:ss").toJSDate(), y: r.temperature })),
			borderColor: colors[label] || "rgba(0, 0, 0, 255)",
			fill: false,
			tension: 0.4,
			radius: 0,
		})));
	};

	await refresh();
	console.log(datasets);

	const ctx = document.getElementsByTagName("canvas").item(0)?.getContext("2d");
	if (!ctx)
		throw new Error("canvas not found");
	new Chart(ctx, {
		type: "line",
		options: {
			scales: {
				x: {
					type: "time",
					time: {
						unit: "hour",
						displayFormats: { hour: "yyyy-LL-dd HH:mm:ss" },
						tooltipFormat: "yyyy-LL-dd HH:mm:ss",
					},
					title: {
						display: true,
						text: "Date",
					},
				},
				y: {
					title: {
						display: true,
						text: "Temp °C",
					}
				}
			},
		},
		data: {
			datasets,
		}
	});
}
