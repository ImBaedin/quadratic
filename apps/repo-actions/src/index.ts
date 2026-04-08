import { createServer, type IncomingMessage } from "node:http";

import { openRouterText } from "@tanstack/ai-openrouter";
import { executeRunEnvelope, runEnvelopeSchema, runResultSchema } from "./agent-runtime";

const port = Number(process.env.PORT ?? "8080");
const serviceToken = process.env.SERVICE_TOKEN;
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const repositoryModel = process.env.REPO_ACTIONS_MODEL ?? "openai/gpt-5.4-nano";
const repositoryModelId = repositoryModel as Parameters<typeof openRouterText>[0];

if (!serviceToken) {
  throw new Error("SERVICE_TOKEN is required");
}

if (!openRouterApiKey) {
  throw new Error("OPENROUTER_API_KEY is required");
}

const server = createServer(async (incomingRequest, outgoingResponse) => {
  const body = await readIncomingBody(incomingRequest);
  const request = new Request(`http://127.0.0.1:${port}${incomingRequest.url ?? "/"}`, {
    method: incomingRequest.method,
    headers: incomingRequest.headers as HeadersInit,
    body: body.length > 0 ? body : undefined,
  });

  const response = await handleRequest(request);
  outgoingResponse.statusCode = response.status;

  response.headers.forEach((value, key) => {
    outgoingResponse.setHeader(key, value);
  });

  outgoingResponse.end(await response.text());
});

server.listen(port, () => {
  console.log(`repo-actions listening on http://0.0.0.0:${port}`);
});

async function handleRequest(request: Request) {
  try {
    if (request.method !== "POST") {
      return text("Method not allowed", 405);
    }

    const authError = authorize(request);
    if (authError) {
      return authError;
    }

    if (!request.url.endsWith("/runs/execute")) {
      return text("Not found", 404);
    }

    const payload = runEnvelopeSchema.parse(await request.json());
    const result = await executeRunEnvelope({
      envelope: payload,
      adapter: openRouterText(repositoryModelId),
      installationToken:
        typeof payload.metadata.installationToken === "string"
          ? payload.metadata.installationToken
          : undefined,
      openRouterApiKey,
    });

    return json(runResultSchema.parse(result), result.status === "succeeded" ? 200 : 500);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown service error";
    return json({ error: message }, 500);
  }
}

async function readIncomingBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

function authorize(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${serviceToken}`) {
    return text("Unauthorized", 401);
  }

  return null;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function text(payload: string, status = 200) {
  return new Response(payload, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
