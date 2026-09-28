"""
Дев-сервер прототипа без кэша: браузер каждый раз берёт свежие файлы.

build_assets.py пересобирает картинки под теми же именами, и обычный `python3 -m http.server`
отдаёт их без запрета кэша – браузер показывает старую версию, пока не почистишь кэш.
Здесь у каждого ответа `Cache-Control: no-store`.

    python3 prototype/tools/serve.py          # http://localhost:8765/
    python3 prototype/tools/serve.py 8766
"""
import argparse
import functools
import http.server
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # prototype/


class Server(http.server.ThreadingHTTPServer):
    # стенд тянет десятки картинок сразу: при очереди по умолчанию (5) соединения сбрасываются
    request_queue_size = 128
    daemon_threads = True


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description="Дев-сервер прототипа Blink без кэша")
    parser.add_argument("port", nargs="?", type=int, default=8765)
    parser.add_argument("--bind", default="127.0.0.1")
    args = parser.parse_args()
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    with Server((args.bind, args.port), handler) as server:
        print(f"прототип: http://localhost:{args.port}/", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
