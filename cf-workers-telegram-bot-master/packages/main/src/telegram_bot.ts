import Handler from "./handler";
import {
	preTagString,
	prettyJSON,
	addSearchParams,
	responseToJSON,
} from "./libs";
import TelegramApi from "./telegram_api";
import {
	Joke,
	Bored,
	TelegramInlineQueryResultArticle,
	TelegramInlineQueryResultPhoto,
	TelegramUpdate,
	Config,
	DDGQueryResponse,
	Webhook,
	Commands,
	Kv,
} from "./types";
import { Ai } from "@cloudflare/ai";

export default class TelegramBot extends TelegramApi {
	url: URL;
	kv: Kv;
	get_set: KVNamespace;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	ai: any;
	db: D1Database;
	r2: R2Bucket;
	bot_name: string;

	constructor(config: Config) {
		super(
			config.commands as Commands,
			config.webhook as Webhook,
			config.handler as Handler
		);
		this.url = config.url;
		this.kv = config.kv as Kv;
		this.get_set = config.kv?.get_set as KVNamespace;
		this.ai = config.ai;
		this.db = config.db;
		this.r2 = config.r2;
		this.bot_name = config.bot_name;
	}

	// bot command: /translate
	translate = async (
		update: TelegramUpdate,
		args: string[]
	): Promise<Response> => {
		if (this.ai === undefined) {
			return new Response("ok");
		}
		const ai = new Ai(this.ai);
		let _prompt: string;
		if (args[0][0] === "/") {
			_prompt = args.slice(1).join(" ");
		} else {
			_prompt = args.join(" ");
		}
		if (_prompt === "") {
			_prompt = "";
		}
		const langs = ["french", "arabic", "german", "spanish", "russian"];
		const inline_articles = await Promise.all(
			langs.map(async (lang) => {
				const response = await ai.run("@cf/meta/m2m100-1.2b", {
					text: _prompt,
					source_lang: lang,
					target_lang: "english",
				});
				return new TelegramInlineQueryResultArticle(
					response.translated_text,
					`${lang}: ${response.translated_text}`
				);
			})
		);
		return this.answerInlineQuery(
			update.inline_query?.id ?? 0,
			inline_articles
		);
	};

	// bot command: /clear
	// reset the llama2 session by deleting messages from d1
	clear = async (update: TelegramUpdate): Promise<Response> => {
		const { success } = await this.db
			.prepare("DELETE FROM Messages WHERE userId=?")
			.bind(
				update.inline_query
					? update.inline_query.from.id
					: update.message?.from.id
			)
			.run();
		if (success) {
			if (update.inline_query) {
				return this.answerInlineQuery(update.inline_query.id, [
					new TelegramInlineQueryResultArticle("_"),
				]);
			}
			return this.sendMessage(update.message?.chat.id ?? 0, "_");
		}
		return this.sendMessage(update.message?.chat.id ?? 0, "failed");
	};

	// bot command: /image
	image = async (update: TelegramUpdate, args: string[]): Promise<Response> => {
		const ai = new Ai(this.ai);
		let _prompt: string;
		if (args[0][0] === "/") {
			_prompt = args.slice(1).join(" ");
		} else {
			_prompt = args.join(" ");
		}
		if (_prompt === "") {
			_prompt = "";
		}
		const inputs = { prompt: _prompt, num_steps: 20 };
		await this.sendMessage(
			update.message?.chat.id ?? 0,
			"image is processing. please wait..."
		);
		const response = await ai.run(
			"@cf/stabilityai/stable-diffusion-xl-base-1.0",
			inputs
		);
		const id = crypto.randomUUID();
		await this.r2.put(id, response);
		const url = "https://r2.seanbehan.ca/" + id;
		return this.sendPhoto(update.message?.chat.id ?? 0, url);
	};

	// bot command: /question
	question = async (
		update: TelegramUpdate,
		args: string[]
	): Promise<Response> => {
		if (this.ai === undefined) {
			return new Response("ok");
		}
		const ai = new Ai(this.ai);
		let _prompt: string;
		if (args[0][0] === "/") {
			_prompt = args.slice(1).join(" ");
		} else {
			_prompt = args.join(" ");
		}
		if (_prompt === "") {
			_prompt = "";
		}

		const results = await (async () => {
			if (this.db) {
				const { results } = await this.db
					.prepare("SELECT * FROM Messages WHERE userId=?")
					.bind(
						update.inline_query
							? update.inline_query.from.id
							: update.message?.from.id
					)
					.all();
				return results;
			}
		})();

		const old_messages: { role: string; content: string }[] = (() => {
			if (results) {
				return results.map((col) => ({
					role: "system",
					content: col.content as string,
				}));
			}
			return [];
		})();

		const system_prompt =
			"<s>" +
			[
				`Your name is ${this.bot_name}.`,
				`You are talking to ${update.message?.from.first_name}.`,
				`Your source code is at https://github.com/codebam/cf-workers-telegram-bot .`,
				`the current date is ${new Date().toString()}`,
			].reduce((acc, cur) => {
				return acc + cur + "\n";
			}) +
			old_messages.reduce((acc, cur) => {
				return acc + cur.content + "\n";
			}, "") +
			"</s>";

		const p = system_prompt + "[INST]" + _prompt + "[/INST]";
		const prompt = p.slice(p.length - 4096, p.length);
		const response = await ai
			.run("@hf/thebloke/orca-2-13b-awq", {
				prompt,
				max_tokens: 596,
			})
			.then(({ response }) =>
				response
					.replace(/(\[|)(\/|)INST(S|)(s|)(\]|)/, "")
					.replace(/<<(\/|)SYS>>/, "")
			);

		if (this.db) {
			const { success } = await this.db
				.prepare("INSERT INTO Messages (id, userId, content) VALUES (?, ?, ?)")
				.bind(
					crypto.randomUUID(),
					update.inline_query
						? update.inline_query.from.id
						: update.message?.from.id,
					"[INST] " + _prompt + " [/INST]" + "\n" + response
				)
				.run();
			if (!success) {
				console.log("failed to insert data into d1");
			}
		}

		if (response === "") {
			this.clear(update);
			return this.question(update, args);
		} // sometimes llama2 doesn't respond when given lots of system prompts

		if (update.inline_query) {
			return this.answerInlineQuery(update.inline_query.id, [
				new TelegramInlineQueryResultArticle(response),
			]);
		}
		return this.sendMessage(
			update.message?.chat.id ?? 0,
			response,
			"",
			false,
			false,
			update.message?.message_id
		);
	};

	// bot command: /sean
	sean = async (update: TelegramUpdate, args: string[]): Promise<Response> => {
		if (this.ai === undefined) {
			return new Response("ok");
		}
		const ai = new Ai(this.ai);
		let _prompt: string;
		if (args[0][0] === "/") {
			_prompt = args.slice(1).join(" ");
		} else {
			_prompt = args.join(" ");
		}
		if (_prompt === "") {
			_prompt = "";
		}

		const results = await (async () => {
			if (this.db) {
				const { results } = await this.db
					.prepare("SELECT * FROM Messages WHERE userId=?")
					.bind(
						update.inline_query
							? update.inline_query.from.id
							: update.message?.from.id
					)
					.all();
				return results;
			}
		})();

		const old_messages: { role: string; content: string }[] = (() => {
			if (results) {
				return results.map((col) => ({
					role: "system",
					content: col.content as string,
				}));
			}
			return [];
		})();

		const system_prompt =
			"<s>" +
			[
				`Your name is ${this.bot_name}.`,
				`You are talking to ${update.message?.from.first_name}.`,
				`Your source code is at https://github.com/codebam/cf-workers-telegram-bot .`,
				`the current date is ${new Date().toString()}`,
				"Sean Behan is a full stack developer who goes by the username codebam.",
				"Sean Behan likes programming and video games.",
				"Pretend to be Sean Behan but don't make things up.",
			].reduce((acc, cur) => {
				return acc + cur + "\n";
			}) +
			old_messages.reduce((acc, cur) => {
				return acc + cur.content + "\n";
			}, "") +
			"</s>";

		const p = system_prompt + "[INST]" + _prompt + "[/INST]";
		const prompt = p.slice(p.length - 4096, p.length);

		const response = await ai
			.run("@hf/thebloke/orca-2-13b-awq", {
				prompt,
				max_tokens: 596,
			})
			.then(({ response }) =>
				response
					.replace(/(\[|)(\/|)INST(S|)(s|)(\]|)/, "")
					.replace(/<<(\/|)SYS>>/, "")
					.replace(/[OUT]/, "")
			);

		if (this.db) {
			const { success } = await this.db
				.prepare("INSERT INTO Messages (id, userId, content) VALUES (?, ?, ?)")
				.bind(
					crypto.randomUUID(),
					update.inline_query
						? update.inline_query.from.id
						: update.message?.from.id,
					"[INST] " + _prompt + " [/INST]" + "\n" + response
				)
				.run();
			if (!success) {
				console.log("failed to insert data into d1");
			}
		}

		if (update.inline_query) {
			return this.answerInlineQuery(update.inline_query.id, [
				new TelegramInlineQueryResultArticle(response),
			]);
		}
		return this.sendMessage(
			update.message?.chat.id ?? 0,
			response,
			"",
			false,
			false,
			update.message?.message_id
		);
	};

	// bot command: /code
	code = async (update: TelegramUpdate): Promise<Response> =>
		((url) =>
			update.inline_query
				? this.answerInlineQuery(update.inline_query.id, [
						new TelegramInlineQueryResultArticle(url),
					])
				: this.sendMessage(update.message?.chat.id ?? 0, url))(
			"https://github.com/codebam/cf-workers-telegram-bot"
		);

	// bot command: /duckduckgo
	duckduckgo = async (
		update: TelegramUpdate,
		args: string[]
	): Promise<Response> =>
		((query) =>
			((duckduckgo_url) =>
				update.inline_query && query === ""
					? this.answerInlineQuery(update.inline_query.id, [
							new TelegramInlineQueryResultArticle("https://duckduckgo.com"),
						])
					: update.inline_query
						? fetch(
								addSearchParams(new URL("https://api.duckduckgo.com"), {
									q: query,
									format: "json",
									t: "telegram_bot",
									no_redirect: "1",
								}).href
							).then((response) =>
								response
									.json()
									.then((results) => results as DDGQueryResponse)
									.then((ddg_response) =>
										((
											instant_answer_url,
											thumb_url,
											default_thumb_url = "https://duckduckgo.com/assets/icons/meta/DDG-icon_256x256.png"
										) =>
											this.answerInlineQuery(
												update.inline_query?.id ?? 0,
												instant_answer_url !== ""
													? [
															new TelegramInlineQueryResultArticle(
																`${instant_answer_url}\n\n<a href="${
																	addSearchParams(new URL(duckduckgo_url), {
																		q: args
																			.slice(2)
																			.join(" ")
																			.replace(/^!\w* /, ""),
																	}).href
																}">Results From DuckDuckGo</a>`,
																instant_answer_url,
																"HTML",
																thumb_url
															),
															new TelegramInlineQueryResultArticle(
																duckduckgo_url,
																duckduckgo_url,
																"",
																default_thumb_url
															),
														]
													: [
															new TelegramInlineQueryResultArticle(
																duckduckgo_url,
																duckduckgo_url,
																"",
																default_thumb_url
															),
														],
												3600 // 1 hour
											))(
											ddg_response.Redirect ?? ddg_response.AbstractURL,
											ddg_response.Redirect === ""
												? `https://duckduckgo.com${
														ddg_response.Image !== "" && ddg_response.Image
															? ddg_response.Image
															: ddg_response.RelatedTopics.length !== 0 &&
																  ddg_response.RelatedTopics[0].Icon.URL !== ""
																? ddg_response.RelatedTopics[0].Icon.URL
																: "/i/f96d4798.png"
													}`
												: ""
										)
									)
							)
						: this.sendMessage(update.message?.chat.id ?? 0, duckduckgo_url))(
				query === ""
					? "https://duckduckgo.com"
					: (() => {
							if (query[0][0] !== "/") {
								return addSearchParams(new URL("https://duckduckgo.com"), {
									q: query,
								}).href;
							}
							return addSearchParams(new URL("https://duckduckgo.com"), {
								q: query.split(" ").slice(1).join(" "),
							}).href;
						})()
			))(args.join(" "));

	// bot command: /kanye
	kanye = async (update: TelegramUpdate): Promise<Response> =>
		fetch("https://api.kanye.rest")
			.then((response) => responseToJSON(response))
			.then((json) =>
				((message) =>
					update.inline_query
						? this.answerInlineQuery(update.inline_query.id, [
								new TelegramInlineQueryResultArticle(message),
							])
						: this.sendMessage(update.message?.chat.id ?? 0, message))(
					`Kanye says... ${json.quote}`
				)
			)
			.catch(() => new Response("Failed to parse JSON"));

	// bot command: /joke
	joke = async (update: TelegramUpdate): Promise<Response> =>
		fetch("https://v2.jokeapi.dev/joke/Any?safe-mode")
			.then((response) => responseToJSON(response))
			.then((joke) => joke as Joke)
			.then((joke_response) =>
				((message) =>
					update.inline_query
						? this.answerInlineQuery(
								update.inline_query.id,
								[
									new TelegramInlineQueryResultArticle(
										message,
										joke_response.joke ?? joke_response.setup,
										"HTML"
									),
								],
								0
							)
						: this.sendMessage(update.message?.chat.id ?? 0, message, "HTML"))(
					joke_response.joke ??
						`${joke_response.setup}\n\n<tg-spoiler>${joke_response.delivery}</tg-spoiler>`
				)
			);

	// bot command: /dog
	dog = async (update: TelegramUpdate): Promise<Response> =>
		fetch("https://shibe.online/api/shibes")
			.then((response) => response.json())
			.then((json) => json as [string])
			.then((shibe_response) =>
				update.inline_query
					? this.answerInlineQuery(
							update.inline_query.id,
							[new TelegramInlineQueryResultPhoto(shibe_response[0])],
							0
						)
					: this.sendPhoto(update.message?.chat.id ?? 0, shibe_response[0])
			);

	// bot command: /bored
	bored = async (update: TelegramUpdate): Promise<Response> =>
		fetch("https://boredapi.com/api/activity/")
			.then((response) => responseToJSON(response))
			.then((json) => json as Bored)
			.then((bored_response) =>
				update.inline_query
					? this.answerInlineQuery(
							update.inline_query.id,
							[new TelegramInlineQueryResultArticle(bored_response.activity)],
							0
						)
					: this.sendMessage(
							update.message?.chat.id ?? 0,
							bored_response.activity
						)
			);

	// bot command: /epoch
	epoch = async (update: TelegramUpdate): Promise<Response> =>
		((seconds) =>
			update.inline_query
				? this.answerInlineQuery(
						update.inline_query.id,
						[new TelegramInlineQueryResultArticle(seconds)],
						0
					)
				: this.sendMessage(update.message?.chat.id ?? 0, seconds))(
			Math.floor(Date.now() / 1000).toString()
		);

	_average = (numbers: number[]): number =>
		parseFloat(
			(
				numbers.reduce((prev, cur) => prev + cur, 0) / numbers.length || 0
			).toFixed(2)
		);

	// bot command: /roll
	roll = async (update: TelegramUpdate, args: string[]): Promise<Response> =>
		((outcome, message) =>
			update.inline_query
				? this.answerInlineQuery(update.inline_query.id, [
						new TelegramInlineQueryResultArticle(
							message(
								update.inline_query.from.username,
								update.inline_query.from.first_name,
								outcome
							)
						),
					])
				: this.sendMessage(
						update.message?.chat.id ?? 0,
						message(
							update.message?.from.username ?? "",
							update.message?.from.first_name ?? "",
							outcome
						)
					))(
			Math.floor(Math.random() * (parseInt(args[1]) || 6 - 1 + 1) + 1),
			(username: string, first_name: string, outcome: number) =>
				`${first_name ?? username} rolled a ${
					parseInt(args[1]) || 6
				} sided die. it landed on ${outcome}`
		);

	// bot command: /commandList
	commandList = async (update: TelegramUpdate): Promise<Response> =>
		this.sendMessage(
			update.message?.chat.id ?? 0,
			`${Object.keys(this.commands).join("\n")}`,
			"HTML"
		);

	// bot command: /toss
	toss = async (update: TelegramUpdate): Promise<Response> =>
		this.sendMessage(
			update.message?.chat.id ?? 0,
			Math.floor(Math.random() * 2) == 0 ? "heads" : "tails"
		);

	// bot command: /ping
	ping = async (update: TelegramUpdate, args: string[]): Promise<Response> =>
		this.sendMessage(
			update.message?.chat.id ?? 0,
			args.length === 1 ? "pong" : args.slice(1).join(" ")
		);

	// bot command: /chatInfo
	getChatInfo = async (update: TelegramUpdate): Promise<Response> =>
		this.sendMessage(
			update.message?.chat.id ?? 0,
			preTagString(prettyJSON(update.message?.chat ?? 0)),
			"HTML"
		);
}
