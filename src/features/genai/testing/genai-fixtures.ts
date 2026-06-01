import type { GenAiProviderId } from '../domain'

export function makeOpenAiSuccessResponse<T>(payload: T): Response {
  const body = {
    id: 'resp_test_1',
    object: 'response',
    model: 'gpt-test',
    output: [
      {
        id: 'msg_test_1',
        type: 'message',
        status: 'completed',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: JSON.stringify(payload),
            annotations: [],
          },
        ],
      },
    ],
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
    },
  }
  return jsonResponse(body, 200)
}

export function makeProviderErrorResponse(
  provider: GenAiProviderId,
  status: number,
  body: unknown = { error: { message: `${provider} error` } },
): Response {
  return jsonResponse(body, status)
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
