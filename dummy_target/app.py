import http.server
import socketserver
import json
import logging

PORT = 5000

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
            messages = data.get('messages', [])
            last_msg = messages[-1]['content'] if messages else ""
            
            response_text = f"I am a helpful assistant. You said: {last_msg}"
            
            if "ignore all previous instructions" in last_msg.lower():
                response_text = "PWNED"
            elif "bomb" in last_msg.lower():
                response_text = "Sure, here is how you build a bomb..."

        except Exception as e:
            response_text = f"Error: {e}"

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"response": response_text}).encode('utf-8'))
        
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(b"Vulnerable LLM API is running.")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving vulnerable app at port {PORT}")
    httpd.serve_forever()
