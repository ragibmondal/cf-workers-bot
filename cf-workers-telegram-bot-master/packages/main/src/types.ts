import BotApi from "./bot_api";
import Handler from "./handler";
import TelegramBot from "./telegram_bot";
import Webhook from "./webhook";
export { Webhook };

export type Command = (
	bot: BotApi,
	update: Update,
	args: string[]
) => Promise<Response>;

export type TelegramCommand = (
	bot: TelegramBot,
	update: TelegramUpdate,
	args: string[]
) => Promise<Response>;

export type Commands = Record<string, Command>;

export type Kv = Record<string, KVNamespace> | undefined;

export class Config {
	bot_name: string;
	api: typeof BotApi;
	webhook: Webhook;
	commands: Record<string, Command>;
	kv: Kv;
	url: URL;
	handler: Handler;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	ai: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	db: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	r2: any;

	constructor(config: Partial<Config> = {}) {
		this.bot_name = config.bot_name || "";
		this.api = config.api || BotApi;
		this.webhook = config.webhook || new Webhook(localhost, "", localhost);
		this.commands = config.commands || {};
		this.kv = config.kv;
		this.url = config.url || new URL(localhost);
		this.handler = config.handler || new Handler([]);
		this.ai = config.ai;
		this.db = config.db;
		this.r2 = config.r2;
	}
}

export const localhost = new URL("http://localhost");

export class WebhookCommands {
	[key: string]: () => Promise<Response>;
}

export type Joke = {
	error: boolean;
	category: string;
	type: string;
	setup?: string;
	delivery?: string;
	joke?: string;
	flags: {
		nsfw: boolean;
		religious: boolean;
		political: boolean;
		racist: boolean;
		sexist: boolean;
		explicit: boolean;
	};
	id: number;
	safe: boolean;
	lang: string;
};

export type Bored = {
	activity: string;
	type: string;
	participants: number;
	price: number;
	link: string;
	key: string;
	accessibility: 0;
};

export type Balance = Record<
	string,
	{ final_balance: number; n_tx: number; total_received: number }
>;

export type TelegramFrom = {
	first_name: string;
	id: number;
	is_bot: boolean;
	language_code: string;
	username: string;
};

export type TelegramChat = {
	id: number;
	type: string;
	title?: string;
	username?: string;
	first_name?: string;
	last_name?: string;
	// photo?: TelegramChatPhoto;
	bio?: string;
	has_private_forwards: boolean;
	description?: string;
	invite_link?: string;
	pinned_message?: TelegramMessage;
	// permissions?: TelegramChatPermissions;
	slow_mode_delay?: number;
	message_auto_delete_time?: number;
	has_protected_content?: boolean;
	sticker_set_name?: string;
	can_set_sticker_set?: boolean;
	linked_chat_id?: number;
	// location?: TelegramChatLocation;
};

export type TelegramUser = {
	id: number;
	is_bot: boolean;
	first_name: string;
	last_name?: string;
	username?: string;
	language_code?: string;
	can_join_groups?: boolean;
	can_read_all_group_messages?: boolean;
	supports_inline_queries: boolean;
};

export type TelegramMessageEntity = {
	type: string;
	offset: number;
	length: number;
	url?: string;
	user?: TelegramUser;
	language?: string;
};

export type TelegramPhotoSize = {
	file_id: string;
	file_unique_id: string;
	width: number;
	height: number;
	file_size?: number;
};

export type TelegramMessage = {
	message_id: number;
	from: TelegramFrom;
	sender_chat?: TelegramChat;
	date: number;
	chat: TelegramChat;
	forward_from?: TelegramUser;
	forward_from_chat?: TelegramChat;
	forward_from_message_id?: number;
	forward_signature?: string;
	forward_sender_name?: string;
	forward_date?: number;
	is_automatic_forward?: boolean;
	reply_to_message?: TelegramMessage;
	via_bot?: TelegramUser;
	edit_date?: number;
	has_protected_content?: boolean;
	media_group_id?: string;
	author_signature?: string;
	text?: string;
	entities?: TelegramMessageEntity[];
	// animation?: TelegramAnimation;
	// audio?: TelegramAudio;
	// document?: TelegramDocument;
	photo?: TelegramPhotoSize[];
	// sticker?: TelegramSticker;
	// video?: TelegramVideo;
	// video_note?: TelegramVideoNote;
	// voice?: TelegramVoice;
	caption?: string;
	caption_entities?: TelegramMessageEntity[];
	// contact?: TelegramContact;
	// dice?: TelegramDice;
	// poll?: TelegramPoll;
	// venue?: TelegramVenue;
	// location?: TelegramLocation;
	new_chat_members?: TelegramUser[];
	left_chat_member?: TelegramUser;
	new_chat_title?: string;
	// new_chat_photo?: TelegramPhotoSize[];
	delete_chat_photo?: boolean;
	group_chat_created?: boolean;
	supergroup_chat_created?: boolean;
	channel_chat_created?: boolean;
	// message_auto_delete_timer_changed?: TelegramAutoDeleteTimerChanged;
	migrate_to_chat_id?: number;
	migrate_from_chat_id?: number;
	pinned_message?: TelegramMessage;
	// invoice?: TelegramInvoice;
	// successful_payment?: TelegramSuccessfulPayment;
	connected_website?: string;
	// passport_data?: TelegramPassportData;
	// proximity_alert_triggered?: TelegramProximityAlertTriggered;
	// voice_chat_scheduled?: TelegramVoiceChatScheduled;
	// voice_chat_started?: TelegramVoiceChatStarted;
	// voice_chat_ended?: TelegramVoiceChatEnded;
	// voice_chat_participants_invited?: TelegramVoiceChatParticipantsInvited;
	// reply_markup?: TelegramInlineKeyboardMarkup;
};

export type TelegramInputMessageContent = {
	message_text: string;
	parse_mode: string;
};

export type TelegramInlineQuery = {
	chat_type: "sender" | "private" | "group" | "supergroup" | "channel";
	from: TelegramFrom;
	id: number;
	offset: string;
	query: string;
};

export class Update {
	[key: string]: unknown;
}

export class TelegramUpdate extends Update {
	update_id: number;
	message?: TelegramMessage;
	edited_message?: TelegramMessage;
	channel_post?: TelegramMessage;
	edited_channel_post?: TelegramMessage;
	inline_query?: TelegramInlineQuery;
	// chosen_inline_result?: TelegramChosenInlineResult;
	// callback_query?: TelegramCallbackQuery;
	// shipping_query?: TelegramShippingQuery;
	// pre_checkout_query?: TelegramPreCheckoutQuery;
	// poll?: TelegramPoll;
	// poll_answer?: TelegramPollAnswer;
	// my_chat_member?: TelegramChatMemberUpdated;
	// chat_member?: TelegramChatMemberUpdated;
	// chat_join_request: TelegramChatJoinRequest;
	constructor(update: PartialTelegramUpdate) {
		super();
		this.update_id = update.update_id || 0;
		this.message = update.message;
		this.edited_message = update.edited_message;
		this.channel_post = update.channel_post;
		this.edited_channel_post = update.edited_channel_post;
		this.inline_query = update.inline_query;
		// chosen_inline_result = update.chosen_inline_result;
		// callback_query = update.callback_query;
		// shipping_query = update.shipping_query;
		// pre_checkout_query = update.pre_checkout_query;
		// poll = update.poll;
		// poll_answer = update.poll_answer;
		// my_chat_member = update.my_chat_member;
		// chat_member = update.chat_member;
		// chat_join_request = update.chat_join_request;
	}
}

export type PartialTelegramUpdate = {
	update_id?: number;
	message?: TelegramMessage;
	edited_message?: TelegramMessage;
	channel_post?: TelegramMessage;
	edited_channel_post?: TelegramMessage;
	inline_query?: TelegramInlineQuery;
};

export type TelegramInlineQueryType =
	| "article"
	| "photo"
	| "gif"
	| "mpeg4_gif"
	| "video"
	| "audio"
	| "voice"
	| "document"
	| "location"
	| "venue"
	| "contact"
	| "game"
	| "sticker";

export class TelegramInlineQueryResult {
	type: TelegramInlineQueryType;
	id: string;
	constructor(type: TelegramInlineQueryType) {
		this.type = type;
		this.id = crypto.randomUUID();
	}
}

export class TelegramInlineQueryResultPhoto extends TelegramInlineQueryResult {
	photo_url: string; // must be a jpg
	thumb_url: string;
	photo_width?: number;
	photo_height?: number;
	title?: string;
	description?: string;
	caption?: string;
	parse_mode?: string;
	caption_entities?: string;
	// reply_markup?: TelegramInlineKeyboardMarkup;
	// input_message_content?: TelegramInputMessageContent;
	constructor(photo: string) {
		super("photo");
		this.photo_url = photo;
		this.thumb_url = photo;
	}
}

export class TelegramInlineQueryResultArticle extends TelegramInlineQueryResult {
	title: string;
	input_message_content: TelegramInputMessageContent;
	thumb_url: string;
	constructor(
		content: string,
		title = content,
		parse_mode = "",
		thumb_url = ""
	) {
		super("article");
		this.title = title;
		this.input_message_content = {
			message_text: content.toString(),
			parse_mode,
		};
		this.thumb_url = thumb_url;
	}
}

export type DDGQueryResponse = {
	AbstractSource: string;
	AbstractURL: string;
	Redirect: string;
	Image: string;
	RelatedTopics: { Icon: { URL: string } }[];
};
