"""Run the server: python -m meta_agent_server [--port 8420]"""

import argparse

import uvicorn


def main():
    parser = argparse.ArgumentParser(description="Meta Agent Server")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8420)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()

    uvicorn.run(
        "meta_agent_server.app:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


if __name__ == "__main__":
    main()
