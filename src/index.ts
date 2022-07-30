export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	STEAM_API_KEY: string;
}

// https://developers.cloudflare.com/workers/examples/cors-header-proxy/
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const steamApi = `https://api.steampowered.com`;

const generateResponse = (body: any, type: 'json' | 'string' = 'string', status: number = 200) => {
  return new Response(type === 'json' ? JSON.stringify(body): body, { status, headers: { ...corsHeaders, ...(type==='json' && { 'content-type': 'application/json;charset=UTF-8', }) } });
}

const getSteamId = async (key: string, vanity: string) => {
  if (!vanity) {
    return generateResponse("Invalid query", 'string', 400);
  }

	try {
		const vanityQuery = await fetch(`${steamApi}/ISteamUser/ResolveVanityURL/v1?key=${key}&vanityurl=${vanity}`);
		const { response: { steamid } } = await vanityQuery.json();

		if (steamid || vanity.match(/^[0-9]+$/) !== null) {
			// possibly they passed a steamid as the vanity
      return generateResponse({ steamid: steamid || vanity }, 'json');
		}

		return generateResponse("Not found", 'string', 404);
	} catch (err) {
		return generateResponse("Unable to verify id", 'string', 500);
	}
}

const getOwnedGames = async (key: string, steamid: string) => {
  if (!steamid) {
    return generateResponse("Invalid query", 'string', 400);
  }

	try {
		const ownedGamesQuery = await fetch(`${steamApi}/IPlayerService/GetOwnedGames/v0001/?key=${key}&steamid=${steamid}&format=json&include_appinfo=true&include_played_free_games=true`);
		const { response: { games, game_count } } = await ownedGamesQuery.json();

		if (games && game_count) {
			// possibly they passed a steamid as the vanity
      return generateResponse({ games, game_count }, 'json');
		}

		return generateResponse("Not found", 'string', 404);
	} catch (err) {
		return generateResponse("Unable to query owned games", 'string', 500);
	}
}

async function handleApiRequest(path: string[], request: Request, env: Env) {
  // We've received at API request. Route the request based on the path.

  switch (path[0]) {
    case "steamid-query": {
      return getSteamId(env.STEAM_API_KEY, path[1]);
    }

    case "owned-games": {
      return getOwnedGames(env.STEAM_API_KEY, path[1]);
    }

    default:
      return generateResponse("Not found", 'string', 404);
  }
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const url = new URL(request.url);
    const path = url.pathname.slice(1).split('/');

		switch (path[0]) {
			case "api": {
				return handleApiRequest(path.slice(1), request, env);
      }

			default:
				return generateResponse("Not found", 'string', 404);
		}
	},
};
