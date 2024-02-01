import Webhook from "./webhook";
import { sha256, addSearchParams, fetch_json } from "./libs";
import { WebhookCommands } from "./types";

export default class TelegramWebhook extends Webhook {
	constructor(api: URL, token: string, url: URL) {
		super(api, token, url);
	}

	set = async (drop_pending_updates = true): Promise<Response> =>
		sha256(this.token).then((access_key) =>
			fetch_json(
				addSearchParams(
					new URL(`${this.api.origin}${this.api.pathname}/setWebhook`),
					{
						url: new URL(`${this.url.origin}${this.url.pathname}${access_key}`)
							.href,
						max_connections: "100",
						allowed_updates: JSON.stringify(["message", "inline_query"]),
						drop_pending_updates: drop_pending_updates.toString(),
					}
				)
			)
		);

	get = async (): Promise<Response> =>
		fetch_json(
			new URL(`${this.api.origin}${this.api.pathname}/getWebhookInfo`)
		);

	delete = async (): Promise<Response> =>
		fetch_json(new URL(`${this.api.origin}${this.api.pathname}/deleteWebhook`));

	commands: WebhookCommands = {
		set: this.set,
		get: this.get,
		delete: this.delete,
	};
}
