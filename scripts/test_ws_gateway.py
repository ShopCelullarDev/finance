import asyncio
import json
from starlette.testclient import TestClient
from app.main import app


def test_websocket_gateway():
    print("[*] Probando WebSocket Gateway (/ws/live)...")
    client = TestClient(app)
    with client.websocket_connect("/ws/live") as websocket:
        # 1. Recibir mensaje de bienvenida
        data = websocket.receive_json()
        print("  [WS] Conexión recibida:", data)
        assert data["type"] == "connection_established"
        assert "ticks:stream" in data["active_subscriptions"]

        # 2. Enviar ping
        websocket.send_json({"action": "ping"})
        pong = websocket.receive_json()
        print("  [WS] Ping/Pong recibido:", pong)
        assert pong["type"] == "pong"

        # 3. Suscribirse a un canal específico
        websocket.send_json({"action": "subscribe", "channels": ["signals:BTC/USDT"]})
        sub_resp = websocket.receive_json()
        print("  [WS] Suscripción dinámica:", sub_resp)
        assert sub_resp["type"] == "subscribed"
        assert "signals:BTC/USDT" in sub_resp["channels"]

    print("[+] WebSocket Gateway validado exitosamente!")


if __name__ == "__main__":
    test_websocket_gateway()
