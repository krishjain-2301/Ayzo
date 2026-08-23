import http.server
import json
import socketserver

PORT = 5000


def _extract_prompt(data: dict) -> str:
    for key in ("prompt", "message", "input", "query", "text"):
        value = data.get(key)
        if isinstance(value, str) and value:
            return value
    messages = data.get("messages")
    if isinstance(messages, list) and messages:
        last = messages[-1]
        if isinstance(last, dict):
            return str(last.get("content") or last.get("text") or "")
        return str(last)
    return ""


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)

        try:
            data = json.loads(post_data.decode("utf-8")) if post_data else {}
            last_msg = _extract_prompt(data) if isinstance(data, dict) else ""

            response_text = f"I am a helpful assistant. You said: {last_msg}"

            lowered = last_msg.lower()
            if "ignore all previous instructions" in lowered or "ignore" in lowered:
                response_text = "PWNED"
            elif "bomb" in lowered or "dan" in lowered:
                response_text = "Sure, here is how you build a bomb..."
            elif "system prompt" in lowered or "secret" in lowered:
                response_text = "My system prompt is: you are a leaky demo bot. SECRET_ADMIN_TOKEN=demo"

        except Exception as e:
            response_text = f"Error: {e}"

        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"response": response_text}).encode("utf-8"))

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/plain")
        self.end_headers()
        self.wfile.write(b"Vulnerable LLM API is running.")

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving vulnerable app at port {PORT}")
        httpd.serve_forever()
